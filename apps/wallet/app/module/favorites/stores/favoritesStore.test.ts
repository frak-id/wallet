import { beforeEach, describe, expect, test } from "vitest";
import {
    favoritesStore,
    selectFavorites,
    selectIsFavorite,
} from "./favoritesStore";

describe("favoritesStore", () => {
    beforeEach(() => {
        favoritesStore.setState({ favorites: {} });
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
