import type { RewardSummary } from "@frak-labs/core-sdk";
import { sdkConfigStore } from "@frak-labs/core-sdk";
import {
    getRewardSummary,
    REFERRAL_SUCCESS_EVENT,
} from "@frak-labs/core-sdk/actions";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getRewardSummaryState,
    invalidateRewardSummary,
    isClaimable,
    loadRewardSummary,
    markClaimStarted,
} from "./rewardSummaryStore";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

vi.mock("@frak-labs/core-sdk", async () => {
    const actual = await vi.importActual<typeof import("@frak-labs/core-sdk")>(
        "@frak-labs/core-sdk"
    );
    return {
        ...actual,
        getClientId: vi.fn(() => "client-1"),
        sdkConfigStore: {
            ...actual.sdkConfigStore,
            resolveMerchantId: vi.fn(),
        },
    };
});

const PENDING: RewardSummary = {
    linked: false,
    pending: {
        total: { eurAmount: 5, usdAmount: 5.4, gbpAmount: 4.3 },
        cashback: { eurAmount: 5, usdAmount: 5.4, gbpAmount: 4.3 },
        fromFriends: { eurAmount: 0, usdAmount: 0, gbpAmount: 0 },
        count: 1,
        lockedCount: 0,
        nextUnlockAt: null,
        expiresAt: new Date(Date.now() + 5 * 86_400_000).toISOString(),
    },
    earned: null,
};

const NOTHING: RewardSummary = { linked: false, pending: null, earned: null };

describe("rewardSummaryStore", () => {
    beforeEach(() => {
        vi.mocked(sdkConfigStore.resolveMerchantId).mockResolvedValue(
            MERCHANT_ID
        );
        vi.mocked(getRewardSummary).mockResolvedValue(PENDING);
    });

    it("fetches once for concurrent readers", async () => {
        const [a, b] = await Promise.all([
            loadRewardSummary(),
            loadRewardSummary(),
        ]);

        expect(a).toEqual(PENDING);
        expect(b).toEqual(PENDING);
        expect(getRewardSummary).toHaveBeenCalledTimes(1);
        expect(getRewardSummaryState()).toEqual({
            status: "ready",
            summary: PENDING,
        });
    });

    it("keeps a pending summary for the session only", async () => {
        await loadRewardSummary();

        const key = `frak-reward-summary-${MERCHANT_ID}-client-1`;
        expect(sessionStorage.getItem(key)).not.toBeNull();
        expect(localStorage.getItem(key)).toBeNull();
    });

    it("keeps an empty summary longer, in local storage", async () => {
        vi.mocked(getRewardSummary).mockResolvedValue(NOTHING);

        await loadRewardSummary();

        const key = `frak-reward-summary-${MERCHANT_ID}-client-1`;
        expect(localStorage.getItem(key)).not.toBeNull();
    });

    it("serves the next page from the cache", async () => {
        await loadRewardSummary();
        invalidateRewardSummaryStateOnly();

        expect(await loadRewardSummary()).toEqual(PENDING);
        expect(getRewardSummary).toHaveBeenCalledTimes(1);
    });

    it("never caches a failure", async () => {
        vi.mocked(getRewardSummary).mockResolvedValueOnce(null);

        await loadRewardSummary();

        expect(sessionStorage.length).toBe(0);
        expect(localStorage.length).toBe(0);
    });

    it("refetches after a referral lands", async () => {
        await loadRewardSummary();

        window.dispatchEvent(new Event(REFERRAL_SUCCESS_EVENT));
        expect(getRewardSummaryState().status).toBe("idle");

        await loadRewardSummary();
        expect(getRewardSummary).toHaveBeenCalledTimes(2);
    });

    it("ignores a fetch that an invalidation overtook", async () => {
        let release: (value: RewardSummary) => void = () => {};
        vi.mocked(getRewardSummary).mockReturnValueOnce(
            new Promise((resolve) => {
                release = resolve;
            })
        );

        const stale = loadRewardSummary();
        await vi.waitFor(() => expect(getRewardSummary).toHaveBeenCalled());
        invalidateRewardSummary();
        release(PENDING);
        await stale;

        expect(getRewardSummaryState().status).toBe("idle");
        expect(sessionStorage.length).toBe(0);
        expect(localStorage.length).toBe(0);
    });

    it("keeps the previous summary while an invalidated store refetches", async () => {
        await loadRewardSummary();

        invalidateRewardSummary();

        expect(getRewardSummaryState()).toEqual({
            status: "idle",
            summary: PENDING,
        });
        await loadRewardSummary();
        expect(getRewardSummary).toHaveBeenCalledTimes(2);
    });

    it("keeps a newer fetch in flight when an overtaken one settles", async () => {
        let release: (value: RewardSummary) => void = () => {};
        vi.mocked(getRewardSummary)
            .mockReturnValueOnce(
                new Promise((resolve) => {
                    release = resolve;
                })
            )
            .mockReturnValueOnce(new Promise(() => {}));

        const stale = loadRewardSummary();
        await vi.waitFor(() => expect(getRewardSummary).toHaveBeenCalled());
        invalidateRewardSummary();
        loadRewardSummary();
        await vi.waitFor(() =>
            expect(getRewardSummary).toHaveBeenCalledTimes(2)
        );
        release(PENDING);
        await stale;
        loadRewardSummary();

        expect(getRewardSummary).toHaveBeenCalledTimes(2);
    });

    describe("after a claim started", () => {
        function setVisibility(state: "hidden" | "visible") {
            vi.spyOn(document, "visibilityState", "get").mockReturnValue(state);
            document.dispatchEvent(new Event("visibilitychange"));
        }

        afterEach(() => {
            vi.restoreAllMocks();
        });

        it("refetches once the page is visible again", async () => {
            await loadRewardSummary();
            markClaimStarted();

            setVisibility("hidden");
            expect(getRewardSummaryState().status).toBe("ready");
            setVisibility("visible");
            expect(getRewardSummaryState().status).toBe("idle");

            await loadRewardSummary();
            expect(getRewardSummary).toHaveBeenCalledTimes(2);
        });

        it("refetches when the page returns from the back-forward cache", async () => {
            await loadRewardSummary();
            markClaimStarted();

            window.dispatchEvent(
                new PageTransitionEvent("pageshow", { persisted: true })
            );

            expect(getRewardSummaryState().status).toBe("idle");
        });

        it("leaves the summary alone when no claim started", async () => {
            await loadRewardSummary();

            setVisibility("visible");

            expect(getRewardSummaryState().status).toBe("ready");
        });
    });
});

describe("isClaimable", () => {
    it("is true for an unlinked visitor with something waiting", () => {
        expect(isClaimable(PENDING)).toBe(true);
    });

    it("is false once the deadline has passed", () => {
        const expired = {
            ...PENDING,
            pending: {
                ...(PENDING.pending as NonNullable<RewardSummary["pending"]>),
                expiresAt: new Date(Date.now() - 1000).toISOString(),
            },
        };
        expect(isClaimable(expired)).toBe(false);
    });

    it.each([
        ["no summary", null],
        ["nothing waiting", NOTHING],
        ["a linked visitor", { ...PENDING, linked: true }],
    ])("is false with %s", (_, summary) => {
        expect(isClaimable(summary as RewardSummary | null)).toBe(false);
    });
});

function snapshot(storage: Storage): [string, string][] {
    const entries: [string, string][] = [];
    for (let index = 0; index < storage.length; index++) {
        const key = storage.key(index);
        if (key) entries.push([key, storage.getItem(key) ?? ""]);
    }
    return entries;
}

/** A new page: module state gone, browser storage kept. */
function invalidateRewardSummaryStateOnly() {
    const session = snapshot(sessionStorage);
    const local = snapshot(localStorage);
    invalidateRewardSummary();
    for (const [key, value] of session) sessionStorage.setItem(key, value);
    for (const [key, value] of local) localStorage.setItem(key, value);
}
