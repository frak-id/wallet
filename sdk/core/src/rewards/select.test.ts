import { describe, expect, it } from "vitest";
import type { InteractionTypeKey } from "../constants/interactionTypes";
import type {
    Currency,
    EstimatedReward,
    MerchantReward,
    ProductDetails,
    RuleConditions,
} from "../types";
import goldenRewards from "./fixtures/golden-rewards.json";
import {
    formatBestReward,
    type SelectDisplayCampaignOptions,
    selectBestReward,
    selectDisplayCampaign,
} from "./select";

/** See `scripts/generate-golden-rewards.ts` for why codepoints are asserted. */
const codepoints = (value: string): string[] =>
    Array.from(value, (char) => {
        const code = char.codePointAt(0) ?? 0;
        return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    });

type SelectionOptions = {
    nowIso: string;
    currency: Currency | null;
    audience: "referrer" | "referee" | null;
    targetInteraction: string | null;
    products: ProductDetails[] | null;
};

type DisplayCampaignFixture = {
    name: string;
    description: string;
    kind: "select-display-campaign";
    campaigns: MerchantReward[];
    options: SelectionOptions;
    selected: {
        campaignId: string;
        status: "live" | "upcoming";
        startsAtIso: string | null;
        matchedProductIds: (string | undefined)[] | null;
    } | null;
};

type BestRewardFixture = {
    name: string;
    description: string;
    kind: "select-best-reward";
    campaigns: MerchantReward[];
    options: SelectionOptions;
    best: {
        formatted: string;
        formattedCodepoints: string[];
        payoutType: EstimatedReward["payoutType"];
        minPurchaseAmount: string | null;
        minPurchaseAmountCodepoints: string[] | null;
        minPurchaseValue: number | null;
        lockupDurationDays: number | null;
        isProductScoped: boolean;
        matchedProductIds: (string | undefined)[] | null;
    } | null;
};

/** The pinned "now" from the corpus is rehydrated, never `Date.now()`. */
const toOptions = (
    options: SelectionOptions
): SelectDisplayCampaignOptions => ({
    now: new Date(options.nowIso),
    currency: options.currency ?? undefined,
    audience: options.audience ?? undefined,
    targetInteraction:
        (options.targetInteraction as InteractionTypeKey | null) ?? undefined,
    products: options.products ?? undefined,
});

// The JSON import is inferred as a union of per-entry literal shapes, which
// narrows to `never` under a type predicate. Widen ONCE to the union of the
// declared fixture types — not to a minimal `{ kind: string }` — so the
// payload fields stay genuinely type-checked and a corpus shape drift is a
// type error rather than a silent pass.
const allFixtures = goldenRewards.fixtures as unknown as (
    | DisplayCampaignFixture
    | BestRewardFixture
)[];

const displayCampaignFixtures = allFixtures.filter(
    (fixture): fixture is DisplayCampaignFixture =>
        fixture.kind === "select-display-campaign"
);

const bestRewardFixtures = allFixtures.filter(
    (fixture): fixture is BestRewardFixture =>
        fixture.kind === "select-best-reward"
);

describe("reward selection golden fixtures", () => {
    it("declares the expected format version", () => {
        expect(goldenRewards.formatVersion).toBe(1);
    });

    it("pins an explicit `now` on every selection fixture", () => {
        for (const fixture of [
            ...displayCampaignFixtures,
            ...bestRewardFixtures,
        ]) {
            expect(fixture.options.nowIso).toBe("2025-01-15T00:00:00.000Z");
        }
    });

    it("covers both the selected and the nothing-to-show outcomes", () => {
        expect(
            displayCampaignFixtures.filter(
                (fixture) => fixture.selected === null
            )
        ).not.toHaveLength(0);
        expect(
            bestRewardFixtures.filter((fixture) => fixture.best === null)
        ).not.toHaveLength(0);
    });

    it.each(displayCampaignFixtures)(
        "selectDisplayCampaign reproduces: $description",
        (fixture) => {
            const selected = selectDisplayCampaign(
                fixture.campaigns,
                toOptions(fixture.options)
            );
            if (fixture.selected === null) {
                expect(selected).toBeUndefined();
                return;
            }
            expect(selected?.campaign.campaignId).toBe(
                fixture.selected.campaignId
            );
            expect(selected?.status).toBe(fixture.selected.status);
            expect(selected?.startsAt?.toISOString() ?? null).toBe(
                fixture.selected.startsAtIso
            );
            expect(
                selected?.matchedProducts?.map(
                    (product) => product.productId
                ) ?? null
            ).toEqual(fixture.selected.matchedProductIds);
        }
    );

    it.each(bestRewardFixtures)(
        "selectBestReward reproduces: $description",
        (fixture) => {
            const best = selectBestReward(
                fixture.campaigns,
                toOptions(fixture.options)
            );
            if (fixture.best === null) {
                expect(best).toBeUndefined();
                return;
            }
            expect(best).toBeDefined();
            expect(codepoints(best?.formatted as string)).toEqual(
                fixture.best.formattedCodepoints
            );
            expect(best?.formatted).toBe(fixture.best.formatted);
            expect(best?.payoutType).toBe(fixture.best.payoutType);
            expect(best?.minPurchaseAmount ?? null).toBe(
                fixture.best.minPurchaseAmount
            );
            expect(best?.minPurchaseValue ?? null).toBe(
                fixture.best.minPurchaseValue
            );
            expect(best?.lockupDurationDays ?? null).toBe(
                fixture.best.lockupDurationDays
            );
            expect(best?.isProductScoped).toBe(fixture.best.isProductScoped);
            expect(
                best?.matchedProducts?.map((product) => product.productId) ??
                    null
            ).toEqual(fixture.best.matchedProductIds);
        }
    );
});

const NOW = new Date("2025-01-15T00:00:00Z");
const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

function fixedReward(eur: number): EstimatedReward {
    return {
        payoutType: "fixed",
        amount: { amount: eur, eurAmount: eur, usdAmount: eur, gbpAmount: eur },
    };
}

function uncappedPercentage(percent: number): EstimatedReward {
    return { payoutType: "percentage", percent, percentOf: "purchase_amount" };
}

function startsAtCondition(iso: string): RuleConditions {
    return [{ field: "time.timestamp", operator: "gte", value: unix(iso) }];
}

function campaign(opts: {
    id: string;
    interactionTypeKey?: InteractionTypeKey;
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    conditions?: RuleConditions;
    productScope?: RuleConditions;
    expiresAt?: string | null;
    defaultLockupSeconds?: number;
}): MerchantReward {
    return {
        campaignId: opts.id,
        name: opts.id,
        interactionTypeKey: opts.interactionTypeKey ?? "purchase",
        conditions: opts.conditions ?? [],
        productScope: opts.productScope,
        referrer: opts.referrer,
        referee: opts.referee,
        expiresAt: opts.expiresAt,
        defaultLockupSeconds: opts.defaultLockupSeconds,
    };
}

describe("selectDisplayCampaign", () => {
    it("returns undefined for an empty set", () => {
        expect(selectDisplayCampaign([], { now: NOW })).toBeUndefined();
    });

    it("picks the highest-reward live campaign", () => {
        const result = selectDisplayCampaign(
            [
                campaign({ id: "low", referrer: fixedReward(2) }),
                campaign({ id: "high", referrer: fixedReward(9) }),
            ],
            { now: NOW }
        );
        expect(result?.status).toBe("live");
        expect(result?.campaign.campaignId).toBe("high");
    });

    it("prefers a live campaign over a richer upcoming one", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "upcoming-rich",
                    referrer: fixedReward(50),
                    conditions: startsAtCondition("2025-03-01T00:00:00Z"),
                }),
                campaign({ id: "live-poor", referrer: fixedReward(3) }),
            ],
            { now: NOW }
        );
        expect(result?.status).toBe("live");
        expect(result?.campaign.campaignId).toBe("live-poor");
    });

    it("falls back to the soonest-starting upcoming campaign", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "later",
                    referrer: fixedReward(50),
                    conditions: startsAtCondition("2025-04-01T00:00:00Z"),
                }),
                campaign({
                    id: "sooner",
                    referrer: fixedReward(5),
                    conditions: startsAtCondition("2025-02-01T00:00:00Z"),
                }),
            ],
            { now: NOW }
        );
        expect(result?.status).toBe("upcoming");
        expect(result?.campaign.campaignId).toBe("sooner");
        expect(result?.startsAt?.toISOString()).toBe(
            "2025-02-01T00:00:00.000Z"
        );
    });

    it("skips expired campaigns", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "expired",
                    referrer: fixedReward(99),
                    expiresAt: "2025-01-01T00:00:00Z",
                }),
                campaign({ id: "active", referrer: fixedReward(4) }),
            ],
            { now: NOW }
        );
        expect(result?.campaign.campaignId).toBe("active");
    });

    it("only considers campaigns matching targetInteraction", () => {
        const result = selectDisplayCampaign(
            [
                campaign({
                    id: "referral-rich",
                    interactionTypeKey: "referral",
                    referrer: fixedReward(50),
                }),
                campaign({
                    id: "purchase-poor",
                    interactionTypeKey: "purchase",
                    referrer: fixedReward(4),
                }),
            ],
            { now: NOW, targetInteraction: "purchase" }
        );
        expect(result?.campaign.campaignId).toBe("purchase-poor");
    });

    it("ranks by the referee side when audience is 'referee'", () => {
        const rewards = [
            campaign({
                id: "rich-referrer",
                referrer: fixedReward(50),
                referee: fixedReward(2),
            }),
            campaign({
                id: "rich-referee",
                referrer: fixedReward(1),
                referee: fixedReward(9),
            }),
        ];
        expect(
            selectDisplayCampaign(rewards, { now: NOW })?.campaign.campaignId
        ).toBe("rich-referrer");
        expect(
            selectDisplayCampaign(rewards, { now: NOW, audience: "referee" })
                ?.campaign.campaignId
        ).toBe("rich-referee");
    });

    describe("with a `products` option", () => {
        it("does not change the winner when products is omitted", () => {
            const rewards = [
                campaign({
                    id: "scoped",
                    referrer: fixedReward(9),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
                campaign({ id: "unscoped", referrer: fixedReward(3) }),
            ];
            expect(
                selectDisplayCampaign(rewards, { now: NOW })?.campaign
                    .campaignId
            ).toBe("scoped");
        });

        it("does not change the winner when products is an empty array", () => {
            const rewards = [
                campaign({
                    id: "scoped",
                    referrer: fixedReward(9),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
                campaign({ id: "unscoped", referrer: fixedReward(3) }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [],
            });
            expect(result?.campaign.campaignId).toBe("scoped");
            expect(result?.matchedProducts).toBeUndefined();
        });

        it("prefers a matching-scope campaign over a richer non-matching one (single-product array)", () => {
            const rewards = [
                campaign({
                    id: "rich-nonmatching",
                    referrer: fixedReward(50),
                    productScope: [
                        { field: "sku", operator: "eq", value: "OTHER-SKU" },
                    ],
                }),
                campaign({
                    id: "poor-matching",
                    referrer: fixedReward(5),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHOE-42" }],
            });
            expect(result?.campaign.campaignId).toBe("poor-matching");
            expect(result?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
        });

        it("treats an unscoped campaign as always matching", () => {
            const rewards = [
                campaign({
                    id: "scoped-nonmatching",
                    referrer: fixedReward(50),
                    productScope: [
                        { field: "sku", operator: "eq", value: "OTHER-SKU" },
                    ],
                }),
                campaign({ id: "unscoped", referrer: fixedReward(5) }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHOE-42" }],
            });
            expect(result?.campaign.campaignId).toBe("unscoped");
            // Unscoped winner: no single product "drove" the reward.
            expect(result?.matchedProducts).toBeUndefined();
        });

        it("still ranks normally by reward value among matching campaigns", () => {
            const rewards = [
                campaign({
                    id: "matching-poor",
                    referrer: fixedReward(3),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
                campaign({
                    id: "matching-rich",
                    referrer: fixedReward(9),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHOE-42" }],
            });
            expect(result?.campaign.campaignId).toBe("matching-rich");
        });

        it("any-match: a campaign matches when at least one of several products matches its scope", () => {
            const rewards = [
                campaign({
                    id: "matches-second-product",
                    referrer: fixedReward(20),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
                campaign({ id: "unscoped", referrer: fixedReward(15) }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHIRT-1" }, { sku: "SHOE-42" }],
            });
            expect(result?.campaign.campaignId).toBe("matches-second-product");
        });

        it("a campaign matching none of several products is deprioritized below one that matches", () => {
            const rewards = [
                campaign({
                    id: "rich-nonmatching",
                    referrer: fixedReward(50),
                    productScope: [
                        { field: "sku", operator: "eq", value: "OTHER-SKU" },
                    ],
                }),
                campaign({
                    id: "poor-matching",
                    referrer: fixedReward(5),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHIRT-1" }, { sku: "SHOE-42" }],
            });
            expect(result?.campaign.campaignId).toBe("poor-matching");
        });

        it("matchedProducts contains exactly the matching subset, not the whole input", () => {
            const rewards = [
                campaign({
                    id: "scoped",
                    referrer: fixedReward(9),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [
                    { sku: "SHIRT-1" },
                    { sku: "SHOE-42" },
                    { sku: "HAT-9" },
                ],
            });
            expect(result?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
        });

        it("matchedProducts is undefined for an unscoped winner even with products supplied", () => {
            const rewards = [
                campaign({ id: "unscoped", referrer: fixedReward(9) }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHOE-42" }],
            });
            expect(result?.matchedProducts).toBeUndefined();
        });

        it("matchedProducts is undefined when no products are passed", () => {
            const rewards = [
                campaign({
                    id: "scoped",
                    referrer: fixedReward(9),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ];
            const result = selectDisplayCampaign(rewards, { now: NOW });
            expect(result?.matchedProducts).toBeUndefined();
        });

        it("upcoming path: prefers a matching upcoming campaign over a sooner-starting non-matching one", () => {
            const rewards = [
                campaign({
                    id: "sooner-nonmatching",
                    referrer: fixedReward(50),
                    conditions: startsAtCondition("2025-02-01T00:00:00Z"),
                    productScope: [
                        { field: "sku", operator: "eq", value: "OTHER-SKU" },
                    ],
                }),
                campaign({
                    id: "later-matching",
                    referrer: fixedReward(5),
                    conditions: startsAtCondition("2025-03-01T00:00:00Z"),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ];
            const result = selectDisplayCampaign(rewards, {
                now: NOW,
                products: [{ sku: "SHOE-42" }],
            });
            expect(result?.status).toBe("upcoming");
            expect(result?.campaign.campaignId).toBe("later-matching");
            expect(result?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
        });

        it("upcoming path: does not change the winner when products is omitted", () => {
            const rewards = [
                campaign({
                    id: "later",
                    referrer: fixedReward(50),
                    conditions: startsAtCondition("2025-04-01T00:00:00Z"),
                }),
                campaign({
                    id: "sooner",
                    referrer: fixedReward(5),
                    conditions: startsAtCondition("2025-02-01T00:00:00Z"),
                }),
            ];
            const result = selectDisplayCampaign(rewards, { now: NOW });
            expect(result?.campaign.campaignId).toBe("sooner");
        });
    });
});

describe("formatBestReward", () => {
    it("returns undefined for an empty set", () => {
        expect(formatBestReward([], { now: NOW })).toBeUndefined();
    });

    it("formats the selected campaign's referrer reward by default", () => {
        const formatted = formatBestReward(
            [
                campaign({ id: "low", referrer: fixedReward(2) }),
                campaign({ id: "high", referrer: fixedReward(50) }),
            ],
            { now: NOW }
        );
        expect(formatted).toContain("50");
    });

    it("formats the referee reward when audience is 'referee'", () => {
        const formatted = formatBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    referee: fixedReward(3),
                }),
            ],
            { now: NOW, audience: "referee" }
        );
        expect(formatted).toContain("3");
        expect(formatted).not.toContain("50");
    });

    it("ignores expired campaigns (does not advertise a stale reward)", () => {
        expect(
            formatBestReward(
                [
                    campaign({
                        id: "expired",
                        referrer: fixedReward(99),
                        expiresAt: "2025-01-01T00:00:00Z",
                    }),
                ],
                { now: NOW }
            )
        ).toBeUndefined();
    });

    it("renders an uncapped percentage reward as a percent string", () => {
        expect(
            formatBestReward(
                [campaign({ id: "c", referrer: uncappedPercentage(10) })],
                { now: NOW }
            )
        ).toBe("10 %");
    });
});

describe("selectBestReward", () => {
    it("returns undefined for an empty set", () => {
        expect(selectBestReward([], { now: NOW })).toBeUndefined();
    });

    it("exposes the formatted reward and its payout type", () => {
        const best = selectBestReward(
            [campaign({ id: "c", referrer: fixedReward(50) })],
            { now: NOW }
        );
        expect(best?.formatted).toContain("50");
        expect(best?.payoutType).toBe("fixed");
        expect(best?.minPurchaseAmount).toBeUndefined();
        expect(best?.lockupDurationDays).toBeUndefined();
    });

    it("surfaces the minimum purchase amount when the campaign gates on one", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    conditions: [
                        {
                            field: "purchase.amount",
                            operator: "gte",
                            value: 25,
                        },
                    ],
                }),
            ],
            { now: NOW }
        );
        expect(best?.minPurchaseAmount).toContain("25");
    });

    it("surfaces the lockup duration in whole days", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    defaultLockupSeconds: 7 * 86_400,
                }),
            ],
            { now: NOW }
        );
        expect(best?.lockupDurationDays).toBe(7);
    });

    it("omits a zero lockup", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    defaultLockupSeconds: 0,
                }),
            ],
            { now: NOW }
        );
        expect(best?.lockupDurationDays).toBeUndefined();
    });

    it("surfaces the raw referrer and referee rewards for the breakdown", () => {
        const referrer = uncappedPercentage(10);
        const referee = fixedReward(3);
        const best = selectBestReward(
            [campaign({ id: "c", referrer, referee })],
            {
                now: NOW,
            }
        );
        expect(best?.referrerReward).toEqual(referrer);
        expect(best?.refereeReward).toEqual(referee);
    });

    it("leaves the referee reward undefined when the campaign has none", () => {
        const best = selectBestReward(
            [campaign({ id: "c", referrer: fixedReward(50) })],
            { now: NOW }
        );
        expect(best?.refereeReward).toBeUndefined();
    });

    it("surfaces the raw minimum purchase value alongside the formatted string", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    conditions: [
                        {
                            field: "purchase.amount",
                            operator: "gte",
                            value: 25,
                        },
                    ],
                }),
            ],
            { now: NOW }
        );
        expect(best?.minPurchaseValue).toBe(25);
        expect(best?.minPurchaseAmount).toContain("25");
    });

    it("leaves minPurchaseValue undefined when the campaign has no minimum", () => {
        const best = selectBestReward(
            [campaign({ id: "c", referrer: fixedReward(50) })],
            { now: NOW }
        );
        expect(best?.minPurchaseValue).toBeUndefined();
    });

    it("isProductScoped is false when the campaign has no productScope", () => {
        const best = selectBestReward(
            [campaign({ id: "c", referrer: fixedReward(50) })],
            { now: NOW }
        );
        expect(best?.isProductScoped).toBe(false);
    });

    it("isProductScoped is true when the campaign carries a productScope", () => {
        // The flag is the gate, not the basis: this campaign's percentage is
        // still `percentOf: "purchase_amount"`. See `isMatchedItemsBasis`.
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: uncappedPercentage(10),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ],
            { now: NOW }
        );
        expect(best?.isProductScoped).toBe(true);
    });

    it("surfaces matchedProducts for a scoped campaign matching one of several products", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ],
            {
                now: NOW,
                products: [{ sku: "SHIRT-1" }, { sku: "SHOE-42" }],
            }
        );
        expect(best?.matchedProducts).toEqual([{ sku: "SHOE-42" }]);
    });

    it("leaves matchedProducts undefined when no products are passed", () => {
        const best = selectBestReward(
            [
                campaign({
                    id: "c",
                    referrer: fixedReward(50),
                    productScope: [
                        { field: "sku", operator: "eq", value: "SHOE-42" },
                    ],
                }),
            ],
            { now: NOW }
        );
        expect(best?.matchedProducts).toBeUndefined();
    });
});
