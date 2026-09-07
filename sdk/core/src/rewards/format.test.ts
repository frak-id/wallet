import { describe, expect, it } from "vitest";
import type { Currency, EstimatedReward } from "../types";
import goldenRewards from "./fixtures/golden-rewards.json";
import {
    applyRewardPlaceholder,
    formatEstimatedReward,
    formatRewardOrHide,
} from "./format";

/**
 * Render a string as its codepoints so a mismatch on an invisible ICU
 * character (U+202F vs U+00A0) is readable. See
 * `scripts/generate-golden-rewards.ts` for why every expected string is
 * recorded both literally and as codepoints.
 */
const codepoints = (value: string): string[] =>
    Array.from(value, (char) => {
        const code = char.codePointAt(0) ?? 0;
        return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    });

type EstimatedRewardFixture = {
    name: string;
    description: string;
    kind: "format-estimated-reward";
    reward: EstimatedReward;
    currency: Currency | null;
    formatted: string;
    formattedCodepoints: string[];
};

type RewardOrHideFixture = {
    name: string;
    description: string;
    kind: "format-reward-or-hide";
    reward: EstimatedReward | null;
    currency: Currency | null;
    formatted: string | null;
    formattedCodepoints: string[] | null;
};

// The JSON import is inferred as a union of per-entry literal shapes, which
// narrows to `never` under a type predicate. Widen ONCE to the union of the
// declared fixture types — not to a minimal `{ kind: string }` — so the
// payload fields stay genuinely type-checked and a corpus shape drift is a
// type error rather than a silent pass.
const allFixtures = goldenRewards.fixtures as unknown as (
    | EstimatedRewardFixture
    | RewardOrHideFixture
)[];

const estimatedFixtures = allFixtures.filter(
    (fixture): fixture is EstimatedRewardFixture =>
        fixture.kind === "format-estimated-reward"
);

const orHideFixtures = allFixtures.filter(
    (fixture): fixture is RewardOrHideFixture =>
        fixture.kind === "format-reward-or-hide"
);

type CodepointPair = { label: string; text: string; codes: string[] };

/**
 * Collect every `X` / `XCodepoints` string pair anywhere in the corpus, at any
 * depth.
 *
 * The pairing is a generator invariant with NO representation in the artifact:
 * a reader sees two fields and no stated relationship between them. Walking
 * generically (rather than listing known fields) means nested pairs — e.g.
 * `best.minPurchaseAmount` on a select-best-reward entry — and any pair a
 * future generator adds are covered without anyone remembering to extend a
 * test. Hand-editing one half of a pair to "fix" a failing expectation then
 * fails loudly instead of silently disarming the diagnostic that makes an
 * invisible-character failure readable. Regenerate, never hand-edit.
 */
function collectCodepointPairs(node: unknown, path: string): CodepointPair[] {
    if (Array.isArray(node)) {
        return node.flatMap((item, index) =>
            collectCodepointPairs(item, `${path}[${index}]`)
        );
    }
    if (node === null || typeof node !== "object") return [];

    const record = node as Record<string, unknown>;
    return Object.entries(record).flatMap(([key, value]) => {
        const nested = collectCodepointPairs(value, `${path}.${key}`);
        const codes = record[`${key}Codepoints`];
        if (typeof value !== "string" || !Array.isArray(codes)) return nested;
        return [
            { label: `${path}.${key}`, text: value, codes: codes as string[] },
            ...nested,
        ];
    });
}

describe("reward formatting golden fixtures", () => {
    it("declares the expected format version", () => {
        expect(goldenRewards.formatVersion).toBe(1);
    });

    it("covers every payout type, including both tiered fallbacks", () => {
        const payoutTypes = new Set(
            estimatedFixtures.map((fixture) => fixture.reward.payoutType)
        );
        expect(payoutTypes).toEqual(new Set(["fixed", "percentage", "tiered"]));
        expect(
            estimatedFixtures.some(
                (fixture) => fixture.name === "estimated-tiered-percent-only"
            )
        ).toBe(true);
        expect(
            estimatedFixtures.some(
                (fixture) => fixture.name === "estimated-tiered-zero-amount"
            )
        ).toBe(true);
    });

    it("covers the hidden cases", () => {
        expect(
            orHideFixtures.filter((fixture) => fixture.formatted === null)
        ).not.toHaveLength(0);
    });

    it("keeps every literal in sync with its codepoint list, corpus-wide", () => {
        const pairs = collectCodepointPairs(goldenRewards.fixtures, "fixtures");

        // Guards against the walker silently finding nothing.
        expect(pairs.length).toBeGreaterThan(40);
        for (const pair of pairs) {
            expect({ at: pair.label, codes: codepoints(pair.text) }).toEqual({
                at: pair.label,
                codes: pair.codes,
            });
        }
    });

    it.each(estimatedFixtures)(
        "formatEstimatedReward reproduces: $description",
        (fixture) => {
            const formatted = formatEstimatedReward(
                fixture.reward,
                fixture.currency ?? undefined
            );
            expect(codepoints(formatted)).toEqual(fixture.formattedCodepoints);
            expect(formatted).toBe(fixture.formatted);
        }
    );

    it.each(orHideFixtures)(
        "formatRewardOrHide reproduces: $description",
        (fixture) => {
            const formatted = formatRewardOrHide(
                fixture.reward ?? undefined,
                fixture.currency ?? undefined
            );
            if (fixture.formatted === null) {
                expect(formatted).toBeUndefined();
                return;
            }
            expect(formatted).toBeDefined();
            expect(codepoints(formatted as string)).toEqual(
                fixture.formattedCodepoints
            );
            expect(formatted).toBe(fixture.formatted);
        }
    );
});

const amount = (eur: number) => ({
    amount: eur,
    eurAmount: eur,
    usdAmount: eur,
    gbpAmount: eur,
});

describe("formatEstimatedReward", () => {
    it("formats a fixed reward in the default currency, rounded", () => {
        const reward: EstimatedReward = {
            payoutType: "fixed",
            amount: amount(5.4),
        };
        // Intl renders a narrow no-break space before "€" — assert content.
        const formatted = formatEstimatedReward(reward);
        expect(formatted).toContain("5");
        expect(formatted).not.toContain("6");
        expect(formatted).toContain("€");
    });

    it("renders a percentage reward as a percent string (never a basket amount)", () => {
        const reward: EstimatedReward = {
            payoutType: "percentage",
            percent: 10,
            percentOf: "purchase_amount",
            maxAmount: amount(50),
        };
        expect(formatEstimatedReward(reward)).toBe("10 %");
    });

    it("uses the richest token tier for a tiered reward", () => {
        const reward: EstimatedReward = {
            payoutType: "tiered",
            tierField: "purchase.amount",
            tiers: [
                { minValue: 0, maxValue: 50, amount: amount(2) },
                { minValue: 50, amount: amount(8) },
            ],
        };
        const formatted = formatEstimatedReward(reward);
        expect(formatted).toContain("8");
        expect(formatted).toContain("€");
    });

    it("falls back to the max percent when tiers carry no token amount", () => {
        const reward: EstimatedReward = {
            payoutType: "tiered",
            tierField: "purchase.amount",
            tiers: [
                { minValue: 0, maxValue: 50, percent: 5 },
                { minValue: 50, percent: 12 },
            ],
        };
        expect(formatEstimatedReward(reward)).toBe("12 %");
    });

    it("respects the requested currency", () => {
        const reward: EstimatedReward = {
            payoutType: "fixed",
            amount: amount(5),
        };
        const formatted = formatEstimatedReward(reward, "usd");
        expect(formatted).toContain("5");
        expect(formatted).toContain("$");
    });
});

describe("formatRewardOrHide", () => {
    it("returns undefined for a missing reward", () => {
        expect(formatRewardOrHide(undefined)).toBeUndefined();
    });

    it("formats a fixed reward that carries money value", () => {
        const formatted = formatRewardOrHide({
            payoutType: "fixed",
            amount: amount(5),
        });
        expect(formatted).toContain("5");
        expect(formatted).toContain("€");
    });

    it("hides a fixed reward with no money value", () => {
        expect(
            formatRewardOrHide({ payoutType: "fixed", amount: amount(0) })
        ).toBeUndefined();
    });

    it("always shows a capped percentage as a percent string", () => {
        expect(
            formatRewardOrHide({
                payoutType: "percentage",
                percent: 10,
                percentOf: "purchase_amount",
                maxAmount: amount(50),
            })
        ).toBe("10 %");
    });

    it("shows an uncapped percentage as a percent string (no money value)", () => {
        expect(
            formatRewardOrHide({
                payoutType: "percentage",
                percent: 8,
                percentOf: "purchase_amount",
            })
        ).toBe("8 %");
    });

    it("shows a percent-only tiered reward instead of hiding it", () => {
        expect(
            formatRewardOrHide({
                payoutType: "tiered",
                tierField: "purchase.amount",
                tiers: [
                    { minValue: 0, maxValue: 50, percent: 5 },
                    { minValue: 50, percent: 12 },
                ],
            })
        ).toBe("12 %");
    });
});

describe("applyRewardPlaceholder", () => {
    it("substitutes the reward into the placeholder", () => {
        expect(applyRewardPlaceholder("Earn {REWARD} now", "5 €")).toBe(
            "Earn 5 € now"
        );
    });

    it("strips the placeholder when no reward is provided", () => {
        expect(applyRewardPlaceholder("Earn {REWARD} now", undefined)).toBe(
            "Earn  now"
        );
    });
});
