import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../config/sdkConfigStore", () => ({
    sdkConfigStore: {
        resolveMerchantId: vi
            .fn()
            .mockResolvedValue("9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e"),
    },
}));

import { getClientId, initClientId } from "../config/clientId";
import { setEnvironment } from "../config/environment";
import { decodeProof } from "../identity/canonical";
import type { RewardSummary } from "../types";
import { getRewardSummary } from "./getRewardSummary";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

const SUMMARY: RewardSummary = {
    linked: false,
    pending: {
        total: { eurAmount: 12.5, usdAmount: 13.4, gbpAmount: 10.8 },
        cashback: { eurAmount: 5, usdAmount: 5.4, gbpAmount: 4.3 },
        fromFriends: { eurAmount: 7.5, usdAmount: 8, gbpAmount: 6.5 },
        count: 2,
        lockedCount: 0,
        nextUnlockAt: null,
        expiresAt: "2026-12-05T00:00:00.000Z",
    },
    earned: null,
};

function jsonResponse(body: unknown, ok = true) {
    return { ok, json: vi.fn().mockResolvedValue(body) };
}

describe("getRewardSummary", () => {
    let fetchSpy: ReturnType<typeof vi.fn>;

    beforeEach(() => {
        localStorage.clear();
        sessionStorage.clear();
        fetchSpy = vi.fn().mockResolvedValue(jsonResponse(SUMMARY));
        vi.stubGlobal("fetch", fetchSpy);
        setEnvironment("prod");
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("sends the client id with a proof that verifies for it", async () => {
        await initClientId();
        const clientId = getClientId();

        const summary = await getRewardSummary();

        expect(summary).toEqual(SUMMARY);
        expect(fetchSpy).toHaveBeenCalledTimes(1);
        const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
        expect(url).toBe(
            `https://backend.frak.id/user/merchant/rewards-summary?merchantId=${MERCHANT_ID}`
        );
        const headers = init.headers as Record<string, string>;
        expect(headers["x-frak-client-id"]).toBe(clientId);
        expect(decodeProof(headers["x-frak-proof"])?.pk.length).toBe(65);
    });

    it("never asks without a key: a bare client id is public", async () => {
        localStorage.setItem("frak-client-id", "legacy-id-no-key");

        expect(await getRewardSummary()).toBeNull();
        expect(fetchSpy).not.toHaveBeenCalled();
    });

    it("returns null on a non-2xx response", async () => {
        await initClientId();
        fetchSpy.mockResolvedValue(jsonResponse({ error: "nope" }, false));

        expect(await getRewardSummary()).toBeNull();
    });

    it("returns null on a body that is not a summary", async () => {
        await initClientId();
        fetchSpy.mockResolvedValue(jsonResponse({ linked: "yes" }));

        expect(await getRewardSummary()).toBeNull();
    });

    it("returns null when the request throws", async () => {
        await initClientId();
        fetchSpy.mockRejectedValue(new Error("offline"));

        expect(await getRewardSummary()).toBeNull();
    });

    it("returns null when the request never answers", async () => {
        await initClientId();
        vi.useFakeTimers();
        try {
            fetchSpy.mockImplementation(
                (_url: string, init: RequestInit) =>
                    new Promise((_resolve, reject) => {
                        init.signal?.addEventListener("abort", () =>
                            reject(new Error("aborted"))
                        );
                    })
            );

            const pending = getRewardSummary();
            await vi.advanceTimersByTimeAsync(5000);

            expect(await pending).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });
});
