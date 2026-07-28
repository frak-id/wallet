import { beforeEach, describe, expect, test, vi } from "vitest";
import {
    favoritesStore,
    selectFavorites,
    selectIsFavorite,
} from "./favoritesStore";

const { trackEvent } = vi.hoisted(() => ({ trackEvent: vi.fn() }));

vi.mock("@frak-labs/wallet-shared", async (importOriginal) => {
    const actual =
        await importOriginal<typeof import("@frak-labs/wallet-shared")>();
    return { ...actual, trackEvent };
});

describe("favoritesStore", () => {
    beforeEach(() => {
        favoritesStore.setState({ favorites: {} });
        trackEvent.mockClear();
    });

    test("starts with no favorites", () => {
        expect(favoritesStore.getState().favorites).toEqual({});
    });

    test("toggleFavorite adds a merchant", () => {
        favoritesStore.getState().toggleFavorite("merchant-1");
        expect(favoritesStore.getState().favorites).toEqual({
            "merchant-1": true,
        });
    });

    test("toggleFavorite twice removes the merchant", () => {
        const { toggleFavorite } = favoritesStore.getState();
        toggleFavorite("merchant-1");
        toggleFavorite("merchant-1");
        expect(favoritesStore.getState().favorites).toEqual({});
    });

    test("toggleFavorite tracks add then remove for a merchant", () => {
        const { toggleFavorite } = favoritesStore.getState();
        toggleFavorite("merchant-1");
        expect(trackEvent).toHaveBeenNthCalledWith(1, "favorite_toggled", {
            merchant_id: "merchant-1",
            action: "add",
        });
        toggleFavorite("merchant-1");
        expect(trackEvent).toHaveBeenNthCalledWith(2, "favorite_toggled", {
            merchant_id: "merchant-1",
            action: "remove",
        });
    });

    test("toggling one merchant leaves others untouched", () => {
        const { toggleFavorite } = favoritesStore.getState();
        toggleFavorite("merchant-1");
        toggleFavorite("merchant-2");
        toggleFavorite("merchant-1");
        expect(favoritesStore.getState().favorites).toEqual({
            "merchant-2": true,
        });
    });

    describe("selectIsFavorite", () => {
        test("reflects whether the merchant is favorited", () => {
            favoritesStore.getState().toggleFavorite("merchant-1");
            const state = favoritesStore.getState();
            expect(selectIsFavorite("merchant-1")(state)).toBe(true);
            expect(selectIsFavorite("merchant-2")(state)).toBe(false);
        });
    });

    describe("selectFavorites", () => {
        test("returns a stable reference until a toggle mutates it", () => {
            const before = selectFavorites(favoritesStore.getState());
            expect(selectFavorites(favoritesStore.getState())).toBe(before);

            favoritesStore.getState().toggleFavorite("merchant-1");
            expect(selectFavorites(favoritesStore.getState())).not.toBe(before);
        });
    });
});
