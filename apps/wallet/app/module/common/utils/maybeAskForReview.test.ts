import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { platform, stage, auth, requestStoreReview, trackEvent } = vi.hoisted(
    () => ({
        platform: { IS_TAURI: true },
        stage: { isProdStage: true },
        auth: { session: { address: "0x1" } as object | null },
        requestStoreReview: vi.fn(() => Promise.resolve(true)),
        trackEvent: vi.fn(),
    })
);

vi.mock("@frak-labs/app-essentials/utils/platform", () => ({
    get IS_TAURI() {
        return platform.IS_TAURI;
    },
}));
vi.mock("@frak-labs/wallet-shared", () => ({
    get isProdStage() {
        return stage.isProdStage;
    },
    sessionStore: { getState: () => ({ session: auth.session }) },
    trackEvent,
}));
vi.mock("./storeReview", () => ({ requestStoreReview }));

import { biometricsStore } from "@/module/biometrics/stores/biometricsStore";
import { modalStore } from "@/module/stores/modalStore";
import { reviewPromptStore } from "@/module/stores/reviewPromptStore";
import { maybeAskForReview, registerAppLaunch } from "./maybeAskForReview";

const SETTLE_MS = 1_500;
const DAY = 24 * 60 * 60 * 1000;

const settle = () => vi.advanceTimersByTimeAsync(SETTLE_MS);

describe("maybeAskForReview", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        platform.IS_TAURI = true;
        stage.isProdStage = true;
        auth.session = { address: "0x1" };
        requestStoreReview.mockReset();
        requestStoreReview.mockResolvedValue(true);
        trackEvent.mockClear();
        sessionStorage.clear();
        reviewPromptStore.setState({ launchCount: 2, lastAskedAt: null });
        modalStore.getState().dismissAll();
        biometricsStore.setState({ isLocked: false });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("asks once the screen has settled, and records it", async () => {
        maybeAskForReview("game_win");
        expect(requestStoreReview).not.toHaveBeenCalled();

        await settle();

        expect(requestStoreReview).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledWith("store_review_requested", {
            trigger: "game_win",
        });
        expect(reviewPromptStore.getState().lastAskedAt).not.toBeNull();
    });

    it("asks only once when two triggers land in the same window", async () => {
        maybeAskForReview("game_win");
        maybeAskForReview("game_tickets");

        await settle();

        expect(requestStoreReview).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "store_review_requested",
            { trigger: "game_win" }
        );
    });

    it("asks only once when the first native call is still running", async () => {
        const answers: Array<(requested: boolean) => void> = [];
        requestStoreReview.mockImplementation(
            () =>
                new Promise<boolean>((resolve) => {
                    answers.push(resolve);
                })
        );
        maybeAskForReview("game_win");
        maybeAskForReview("game_tickets");

        await settle();
        answers[0]?.(true);
        await vi.advanceTimersByTimeAsync(0);

        expect(requestStoreReview).toHaveBeenCalledTimes(1);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "store_review_requested",
            { trigger: "game_win" }
        );
    });

    it("stays silent outside the Tauri app", async () => {
        platform.IS_TAURI = false;

        maybeAskForReview("game_win");
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
    });

    it("stays silent outside production", async () => {
        stage.isProdStage = false;

        maybeAskForReview("game_win");
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
    });

    it("stays silent inside the 30-day gap", async () => {
        reviewPromptStore.getState().markAsked(Date.now());

        maybeAskForReview("game_win");
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
    });

    it("asks again once 30 days have passed", async () => {
        reviewPromptStore.setState({ lastAskedAt: Date.now() - 31 * DAY });

        maybeAskForReview("game_win");
        await settle();

        expect(requestStoreReview).toHaveBeenCalledTimes(1);
    });

    it("stays silent during the first launch", async () => {
        reviewPromptStore.setState({ launchCount: 1 });

        maybeAskForReview("game_joined");
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
    });

    it("skips without spending the ask when a modal opens in the window", async () => {
        maybeAskForReview("game_win");
        modalStore.getState().openModal({ id: "pendingGains" });

        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
        expect(reviewPromptStore.getState().lastAskedAt).toBeNull();
    });

    it("skips without spending the ask when nobody is logged in", async () => {
        auth.session = null;

        maybeAskForReview("game_win");
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
        expect(reviewPromptStore.getState().lastAskedAt).toBeNull();
    });

    it("skips without spending the ask while the biometric lock is up", async () => {
        biometricsStore.setState({ isLocked: true });

        maybeAskForReview("game_win");
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
        expect(reviewPromptStore.getState().lastAskedAt).toBeNull();
    });

    it("neither records nor tracks when the native call did not request a prompt", async () => {
        requestStoreReview.mockResolvedValue(false);

        maybeAskForReview("game_win");
        await settle();

        expect(trackEvent).not.toHaveBeenCalled();
        expect(reviewPromptStore.getState().lastAskedAt).toBeNull();
    });

    it("asks again at the next moment after a failed native call", async () => {
        requestStoreReview.mockResolvedValueOnce(false);
        maybeAskForReview("game_win");
        await settle();

        maybeAskForReview("game_tickets");
        await settle();

        expect(requestStoreReview).toHaveBeenCalledTimes(2);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "store_review_requested",
            { trigger: "game_tickets" }
        );
    });
});

describe("registerAppLaunch", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        platform.IS_TAURI = true;
        stage.isProdStage = true;
        auth.session = { address: "0x1" };
        requestStoreReview.mockReset();
        requestStoreReview.mockResolvedValue(true);
        trackEvent.mockClear();
        sessionStorage.clear();
        reviewPromptStore.setState({ launchCount: 0, lastAskedAt: null });
        modalStore.getState().dismissAll();
        biometricsStore.setState({ isLocked: false });
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("counts a launch once per webview session", () => {
        registerAppLaunch();
        registerAppLaunch();

        expect(reviewPromptStore.getState().launchCount).toBe(1);
    });

    it("counts again once the webview session is gone", () => {
        registerAppLaunch();
        sessionStorage.clear();
        registerAppLaunch();

        expect(reviewPromptStore.getState().launchCount).toBe(2);
    });

    it("asks on the second launch, not the first", async () => {
        registerAppLaunch();
        await settle();
        expect(requestStoreReview).not.toHaveBeenCalled();

        sessionStorage.clear();
        registerAppLaunch();
        await settle();

        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "store_review_requested",
            { trigger: "app_launch" }
        );
    });

    it("does not ask again on a reload of the same session", async () => {
        reviewPromptStore.setState({ launchCount: 1 });
        registerAppLaunch();
        await settle();
        requestStoreReview.mockClear();

        registerAppLaunch();
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
    });

    it("retries on a later launch when the second launch was blocked", async () => {
        reviewPromptStore.setState({ launchCount: 1 });
        auth.session = null;
        registerAppLaunch();
        await settle();
        expect(requestStoreReview).not.toHaveBeenCalled();

        auth.session = { address: "0x1" };
        sessionStorage.clear();
        registerAppLaunch();
        await settle();

        expect(reviewPromptStore.getState().launchCount).toBe(3);
        expect(trackEvent).toHaveBeenCalledExactlyOnceWith(
            "store_review_requested",
            { trigger: "app_launch" }
        );
    });

    it("stops catching up once an ask succeeded", async () => {
        reviewPromptStore.setState({ launchCount: 1 });
        registerAppLaunch();
        await settle();
        requestStoreReview.mockClear();

        sessionStorage.clear();
        registerAppLaunch();
        await settle();

        expect(requestStoreReview).not.toHaveBeenCalled();
    });
});
