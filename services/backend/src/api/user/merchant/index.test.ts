import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/app-essentials", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    isRunningLocally: false,
}));

import type { MerchantReward } from "@frak-labs/core-sdk";
import { selectBestReward } from "@frak-labs/core-sdk/rewards";
import { Elysia } from "elysia";
import { userMerchantApi, validatePackageIdPlatformPairing } from "./index";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";

function estimatedRewards(query: string) {
    return userMerchantApi.handle(
        new Request(
            `http://localhost/merchant/estimated-rewards?merchantId=${MERCHANT_ID}${query}`
        )
    );
}

describe("validatePackageIdPlatformPairing", () => {
    it("passes when neither packageId nor platform is set", () => {
        expect(validatePackageIdPlatformPairing({})).toBeUndefined();
    });

    it("passes when both packageId and platform are set", () => {
        expect(
            validatePackageIdPlatformPairing({
                packageId: "com.groupeseb.moulinex.food",
                platform: "android",
            })
        ).toBeUndefined();
    });

    it("passes when only platform is set (id/domain resolve, no package lookup)", () => {
        expect(
            validatePackageIdPlatformPairing({ platform: "android" })
        ).toBeUndefined();
    });

    it("rejects packageId without platform", () => {
        expect(
            validatePackageIdPlatformPairing({
                packageId: "com.groupeseb.moulinex.food",
            })
        ).toBe("platform is required when packageId is set");
    });
});

// `t.Boolean()` would coerce "true"/"false" and reject the `?formatted=1`
// contract with a 422, so the schema uses `t.Literal("1")`.
describe("estimated-rewards `formatted` query contract", () => {
    it("accepts formatted=1", async () => {
        const res = await estimatedRewards("&formatted=1");
        expect(res.status).not.toBe(422);
    });

    it("treats an absent formatted the same as no formatting requested", async () => {
        const res = await estimatedRewards("");
        expect(res.status).not.toBe(422);
    });

    it("rejects formatted=true (not the wire contract)", async () => {
        const res = await estimatedRewards("&formatted=true");
        expect(res.status).toBe(422);
    });

    it("rejects formatted=0 (only opt-in `1` is meaningful)", async () => {
        const res = await estimatedRewards("&formatted=0");
        expect(res.status).toBe(422);
    });

    it("rejects a bare `formatted` with no value", async () => {
        const res = await estimatedRewards("&formatted");
        expect(res.status).toBe(422);
    });
});

describe("estimated-rewards formatted=1 mapping", () => {
    function eurReward(): MerchantReward {
        return {
            campaignId: "campaign-1",
            name: "Referral campaign",
            interactionTypeKey: "create_referral_link",
            conditions: [],
            referrer: {
                payoutType: "fixed",
                amount: {
                    amount: 12,
                    eurAmount: 12,
                    usdAmount: 13,
                    gbpAmount: 10,
                },
            },
        };
    }

    it("attaches `best` when a reward is selected", () => {
        const rewards = [eurReward()];
        const best = selectBestReward(rewards, { currency: "eur" });
        const result = { rewards, ...(best && { best }) };

        expect(result.best).toBeDefined();
        expect(result.best?.formatted).toBe("12\u00a0€");
    });

    it("omits `best` (not null, not {}) when nothing is worth showing", () => {
        const best = selectBestReward([], { currency: "eur" });
        const result = { rewards: [], ...(best && { best }) };

        expect(best).toBeUndefined();
        expect("best" in result).toBe(false);
    });
});

// Same regression shape as `track/index.test.ts`: limiters dedupe by name +
// seed, and seed excludes `keyExtractor`, so the three `maxRequests` in this
// tree (60, 90, and `exploreApi`'s 30) must stay pairwise distinct.
describe("merchant route rate limiters — distinct maxRequests", () => {
    function fakeLimiter(
        name: string,
        config: { windowMs: number; maxRequests: number },
        onRun: (name: string) => void
    ) {
        return new Elysia({ name: "Middleware.rateLimit", seed: config })
            .onBeforeHandle(() => {
                onRun(name);
            })
            .as("scoped");
    }

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("resolve, estimated-rewards and explorer buckets all fire independently", async () => {
        const calls: string[] = [];
        const app = new Elysia()
            .use(
                fakeLimiter(
                    "resolve",
                    { windowMs: 60_000, maxRequests: 60 },
                    () => calls.push("resolve")
                )
            )
            .use(
                fakeLimiter(
                    "estimated-rewards",
                    { windowMs: 60_000, maxRequests: 90 },
                    () => calls.push("estimated-rewards")
                )
            )
            .use(
                fakeLimiter(
                    "explorer",
                    { windowMs: 60_000, maxRequests: 30 },
                    () => calls.push("explorer")
                )
            )
            .get("/merchant/probe", () => "ok");

        await app.handle(new Request("http://localhost/merchant/probe"));

        expect(calls).toEqual(["resolve", "estimated-rewards", "explorer"]);
    });

    it("collapses into one bucket when two limiters share the same config", async () => {
        const calls: string[] = [];
        const app = new Elysia()
            .use(
                fakeLimiter(
                    "resolve",
                    { windowMs: 60_000, maxRequests: 30 },
                    () => calls.push("resolve")
                )
            )
            .use(
                fakeLimiter(
                    "explorer",
                    { windowMs: 60_000, maxRequests: 30 },
                    () => calls.push("explorer")
                )
            )
            .get("/merchant/probe", () => "ok");

        await app.handle(new Request("http://localhost/merchant/probe"));

        expect(calls).toEqual(["resolve"]);
    });
});
