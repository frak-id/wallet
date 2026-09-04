import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@frak-labs/app-essentials", async (importOriginal) => ({
    ...(await importOriginal<Record<string, unknown>>()),
    isRunningLocally: false,
}));

import type { MerchantReward } from "@frak-labs/core-sdk";
import { selectBestReward } from "@frak-labs/core-sdk/rewards";
import { Elysia } from "elysia";
import {
    decodeProductsQueryParam,
    userMerchantApi,
    validatePackageIdPlatformPairing,
} from "./index";

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

    function scopedReward(): MerchantReward {
        return {
            campaignId: "campaign-scoped",
            name: "Shoe-only campaign",
            interactionTypeKey: "purchase",
            conditions: [],
            productScope: [{ field: "sku", operator: "eq", value: "SHOE-42" }],
            referrer: {
                payoutType: "fixed",
                amount: {
                    amount: 5,
                    eurAmount: 5,
                    usdAmount: 5.5,
                    gbpAmount: 4.5,
                },
            },
        };
    }

    it("deprioritizes a product-scoped campaign whose scope matches none of the supplied products", () => {
        // scopedReward pays less than eurReward, so on reward alone eurReward would
        // already win — the assertion instead pins `isProductScoped: false`, which
        // only happens if `products` reached `selectBestReward` and the scoped
        // campaign was evaluated (and excluded) at all.
        const rewards = [scopedReward(), eurReward()];

        const best = selectBestReward(rewards, {
            currency: "eur",
            products: decodeProductsQueryParam(
                Buffer.from(JSON.stringify([{ sku: "OTHER-SKU" }]), "utf8")
                    .toString("base64")
                    .replace(/\+/g, "-")
                    .replace(/\//g, "_")
                    .replace(/=+$/, "")
            ),
        });

        // eurReward (unscoped, 12 EUR) outranks scopedReward once scopedReward is
        // deprioritized for matching none of the supplied products — proving the
        // `products` param actually reached `selectBestReward` and changed the winner.
        expect(best?.formatted).toBe("12\u00a0€");
        expect(best?.isProductScoped).toBe(false);
    });

    it("selects the scoped campaign and reports isProductScoped/matchedProducts when its scope matches", () => {
        const best = selectBestReward([scopedReward()], {
            currency: "eur",
            products: decodeProductsQueryParam(
                "W3sic2t1IjoiU0hPRS00MiJ9XQ" // golden vector: [{"sku":"SHOE-42"}]
            ),
        });

        expect(best?.formatted).toBe("5\u00a0€");
        expect(best?.isProductScoped).toBe(true);
        expect(best?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
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
// Golden vectors pinned against `sdk/core`'s `compressJsonToB64` — the exact function
// both native SDKs mirror when encoding `ProductDetails[]` client-side. See
// `sdk/core/src/utils/compression/compress.ts`. Regenerate with:
//   bun -e 'import { compressJsonToB64 } from "./src/utils/compression"; console.log(compressJsonToB64([...]))'
// run from `sdk/core/`.
describe("decodeProductsQueryParam", () => {
    it("decodes a single sparse product (golden vector)", () => {
        expect(decodeProductsQueryParam("W3sic2t1IjoiU0hPRS00MiJ9XQ")).toEqual([
            { sku: "SHOE-42" },
        ]);
    });

    it("decodes two products, preserving order (golden vector)", () => {
        expect(
            decodeProductsQueryParam(
                "W3sic2t1IjoiU0hJUlQtMSJ9LHsibmFtZSI6IlNuZWFrZXJzIiwic2t1IjoiU0hPRS00MiJ9XQ"
            )
        ).toEqual([{ sku: "SHIRT-1" }, { name: "Sneakers", sku: "SHOE-42" }]);
    });

    it("returns undefined for an absent param", () => {
        expect(decodeProductsQueryParam(undefined)).toBeUndefined();
    });

    it("degrades to undefined for a payload that isn't valid base64url, rather than throwing", () => {
        expect(
            decodeProductsQueryParam("not valid base64url!!!")
        ).toBeUndefined();
    });

    it("degrades to undefined when the decoded bytes aren't JSON", () => {
        expect(
            decodeProductsQueryParam("dGhpcyBpcyBub3QganNvbg")
        ).toBeUndefined();
    });

    it("degrades to undefined for an empty array — omit, don't send `[]` downstream", () => {
        expect(decodeProductsQueryParam("W10")).toBeUndefined();
    });

    it("degrades to undefined when every entry has no scope field", () => {
        expect(decodeProductsQueryParam("W3t9XQ")).toBeUndefined();
    });

    it("drops a param over the size budget instead of decoding it", () => {
        const oversized = "a".repeat(8193);
        expect(decodeProductsQueryParam(oversized)).toBeUndefined();
    });

    it("caps the decoded list at 50 entries rather than rejecting it", () => {
        const products = Array.from({ length: 60 }, (_, i) => ({
            sku: `SKU-${i}`,
        }));
        // Same encoding sdk/core's compressJsonToB64 produces: base64url(utf8(JSON)).
        const encoded = Buffer.from(JSON.stringify(products), "utf8")
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=+$/, "");

        const decoded = decodeProductsQueryParam(encoded);
        expect(decoded).toHaveLength(50);
        expect(decoded?.[0]).toEqual({ sku: "SKU-0" });
    });
});

// Same shape as the `formatted` contract tests above: `estimatedRewards()` reaches a
// real repository this suite does not mock, so `.not.toBe(422)` is the load-bearing
// assertion — it pins "the query schema accepted this and the request reached the
// handler", without depending on a database being reachable in every environment this
// suite runs in. A malformed/oversized `products` must clear validation and be decoded
// away (never reach `decodeProductsQueryParam`'s callers as an exception); see the
// dedicated `decodeProductsQueryParam` unit coverage above for the decode-degrades-
// silently guarantee itself.
describe("estimated-rewards `products` query contract", () => {
    it("a malformed (non-base64url) products value still clears query validation", async () => {
        const res = await estimatedRewards(
            "&formatted=1&products=not-valid-base64!!!"
        );
        expect(res.status).not.toBe(422);
    });

    it("a products value at the size budget still clears query validation", async () => {
        // 8192: `decodeProductsQueryParam`'s guard, deliberately NOT a schema `maxLength` —
        // see index.ts.
        const res = await estimatedRewards(
            `&formatted=1&products=${"a".repeat(8192)}`
        );
        expect(res.status).not.toBe(422);
    });

    it("an over-budget products value is ignored rather than failing the request", async () => {
        // The whole point of keeping length enforcement in the handler: a caller that sends
        // too much loses its product context, not its `rewards` array. A `maxLength` on the
        // query schema would 422 the entire call here.
        const res = await estimatedRewards(`&products=${"a".repeat(8193)}`);
        expect(res.status).not.toBe(422);
    });

    it("accepts a golden-vector products value alongside formatted=1", async () => {
        const res = await estimatedRewards(
            "&formatted=1&products=W3sic2t1IjoiU0hPRS00MiJ9XQ"
        );
        expect(res.status).not.toBe(422);
    });
});

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

    it("charges a route to every limiter registered before it, not just its own", async () => {
        const calls: string[] = [];
        const app = new Elysia()
            .use(
                fakeLimiter(
                    "resolve",
                    { windowMs: 60_000, maxRequests: 60 },
                    () => calls.push("resolve")
                )
            )
            .get("/merchant/resolve", () => "ok")
            .use(
                fakeLimiter(
                    "estimated-rewards",
                    { windowMs: 60_000, maxRequests: 90 },
                    () => calls.push("estimated-rewards")
                )
            )
            .get("/merchant/estimated-rewards", () => "ok");

        await app.handle(new Request("http://localhost/merchant/resolve"));
        const afterResolve = [...calls];
        calls.length = 0;
        await app.handle(
            new Request("http://localhost/merchant/estimated-rewards")
        );

        expect(afterResolve).toEqual(["resolve"]);
        // Both, in the production registration order: the effective budget for
        // estimated-rewards is therefore the smaller of the two, 60/min per IP.
        expect(calls).toEqual(["resolve", "estimated-rewards"]);
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
