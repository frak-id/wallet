/**
 * Generates `src/rewards/fixtures/golden-rewards.json` — the frozen
 * cross-platform reward-selection and currency-formatting fixtures.
 *
 * Re-runnable, but deliberately produces IDENTICAL output every time: every
 * input below is a hardcoded constant, there is no randomness, and no time is
 * read from the clock — the reference "now" is the pinned epoch constant
 * `FIXED_NOW_MS`. A fixture regenerated with fresh inputs each run is a
 * round-trip test, not a golden fixture — round-trip tests pass even when two
 * implementations are identically wrong. The whole point of this corpus is to
 * catch the case where Kotlin and Swift reimplement `formatEstimatedReward`
 * and `selectBestReward` and are consistently, silently different from the TS.
 *
 * Run: `bun run fixtures:generate:rewards` from `sdk/core/`.
 *
 * Consumers (must never diverge, by construction):
 *  - `src/rewards/format.test.ts`, `src/rewards/value.test.ts`,
 *    `src/rewards/select.test.ts` (this package)
 *  - `src/utils/format/formatAmount.test.ts` (this package)
 *  - native SDKs read this same repo path via `@frak-labs/core-sdk/rewards/fixtures`;
 *    never copy it
 *
 * ---------------------------------------------------------------------------
 * WHY EVERY EXPECTED STRING IS RECORDED TWICE — DO NOT "CLEAN THIS UP"
 * ---------------------------------------------------------------------------
 * Each formatted string is emitted BOTH literally (`formatted`) AND as an
 * explicit array of codepoint labels (`formattedCodepoints`, e.g.
 * `["U+0031", "U+202F", "U+0032", ..., "U+00A0", "U+20AC"]`).
 *
 * This looks like duplicated data. It is not, and deleting either half makes
 * this corpus much worse. ICU currency formatting emits characters that are
 * invisible in every diff viewer, most editors and most test runners:
 *
 *  - fr-FR (EUR) groups thousands with U+202F NARROW NO-BREAK SPACE, but
 *    separates the amount from the "€" with U+00A0 NO-BREAK SPACE. Two
 *    DIFFERENT invisible spaces inside the SAME string — `"1 234,56 €"` above
 *    is `1 <U+202F> 2 3 4 , 5 6 <U+00A0> €`.
 *  - Older CLDR data (pre-CLDR-34 / pre-ICU-63, which ships on older Android
 *    API levels) uses U+00A0 for the group separator too.
 *  - Some locales use U+2212 MINUS SIGN rather than ASCII "-" for negatives.
 *
 * A Kotlin or Swift assertion failing on `expected "1 234,56 €" but was
 * "1 234,56 €"` is an unreadable mystery that costs an afternoon. The same
 * failure printed as `U+202F` vs `U+00A0` at index 1 is a one-glance
 * diagnosis. So: assert on `formatted`, print `formattedCodepoints` on
 * failure. Keep both.
 *
 * For the same reason the emitted JSON is post-processed to pure ASCII — every
 * codepoint above U+007F is written as a `\uXXXX` escape (so U+00A0 is
 * `\u00a0`, and even "€" is `\u20ac`). That makes the file safe to open, diff
 * and review in any editor, and means an editor that trims or normalises
 * whitespace cannot silently corrupt it. Any future generator writing into
 * this corpus must preserve that property.
 *
 * ---------------------------------------------------------------------------
 * ICU BASELINE — READ BEFORE DEBUGGING A SEPARATOR MISMATCH
 * ---------------------------------------------------------------------------
 * Generated under ICU 74.2 / CLDR 44 (Bun 1.3.x, Node 24.x bundles the same
 * major). The fr-FR expectations are only interpretable against a known
 * baseline, so it is recorded here rather than in the JSON — putting it in the
 * JSON would break byte-determinism across machines with different runtimes.
 *
 * Locales covered — exactly the three the SDK can ever emit (see
 * `src/constants/locales.ts`; `getSupportedCurrency` falls everything else
 * back to `eur`), all left-to-right, no RTL and therefore no U+200E/U+200F
 * directional marks anywhere in this corpus:
 *
 *   eur -> fr-FR    usd -> en-US    gbp -> en-GB
 *
 * Known fragility, stated plainly: the fr-FR entries whose value is >= 1000
 * are ICU-version-dependent. They assert U+202F as the group separator, which
 * is the CLDR 34 / ICU 63 behaviour; a runtime with older CLDR data emits
 * U+00A0 there instead and the fixture fails for a reason that is nobody's
 * bug. Treat a U+202F vs U+00A0 group-separator mismatch as an ENVIRONMENT
 * finding — report the runtime's ICU/CLDR version — not a code defect. fr-FR
 * values below 1000 carry only the long-stable U+00A0 before "€"; en-US and
 * en-GB use ASCII separators and symbols and are not at risk.
 *
 * Negative amounts are deliberately EXCLUDED from this corpus. Negative
 * currency formatting is a second uncontrolled ICU drift axis (ASCII U+002D
 * vs U+2212 MINUS SIGN, and sign placement relative to the symbol), and the
 * SDK never displays a negative reward. Do not "fill the gap" without
 * re-reading this paragraph.
 */

import {
    formatEstimatedReward,
    formatRewardOrHide,
} from "../src/rewards/format";
import {
    type SelectDisplayCampaignOptions,
    selectBestReward,
    selectDisplayCampaign,
} from "../src/rewards/select";
import {
    getRewardRank,
    getRewardValue,
    maxRewardPercent,
} from "../src/rewards/value";
import type {
    Currency,
    EstimatedReward,
    MerchantReward,
    ProductDetails,
    TokenAmountType,
} from "../src/types";
import { formatAmount } from "../src/utils/format/formatAmount";
import { getCurrencyAmountKey } from "../src/utils/format/getCurrencyAmountKey";
import { getSupportedCurrency } from "../src/utils/format/getSupportedCurrency";
import { getSupportedLocale } from "../src/utils/format/getSupportedLocale";

/** Reference "now" for every selection fixture. Pinned, never `Date.now()`. */
const FIXED_NOW_MS = 1_736_899_200_000; // 2025-01-15T00:00:00.000Z
const FIXED_NOW_ISO = new Date(FIXED_NOW_MS).toISOString();

const unix = (iso: string) => Math.floor(new Date(iso).getTime() / 1000);

/** See the header: the diagnosable half of every expected string. */
const codepoints = (value: string): string[] =>
    Array.from(value, (char) => {
        const code = char.codePointAt(0) ?? 0;
        return `U+${code.toString(16).toUpperCase().padStart(4, "0")}`;
    });

type FormattedExpectation = {
    /** The literal expected string. Assert on this. */
    formatted: string;
    /** The same string, one label per codepoint. Print this on failure. */
    formattedCodepoints: string[];
};

const expectString = (value: string): FormattedExpectation => ({
    formatted: value,
    formattedCodepoints: codepoints(value),
});

type FixtureBase = {
    /** Unique kebab-case id. Key on this. */
    name: string;
    /** Human-readable prose. Not unique, never key on this. */
    description: string;
};

type FormatAmountFixture = FixtureBase & {
    kind: "format-amount";
    amount: number;
    /** `null` exercises the "no currency supplied" default (EUR / fr-FR). */
    currency: Currency | null;
    /** Locale the expectation was produced under, resolved by the SDK. */
    locale: string;
} & FormattedExpectation;

type FormatEstimatedRewardFixture = FixtureBase & {
    kind: "format-estimated-reward";
    reward: EstimatedReward;
    currency: Currency | null;
} & FormattedExpectation;

type FormatRewardOrHideFixture = FixtureBase & {
    kind: "format-reward-or-hide";
    /** `null` exercises the "no reward at all" branch. */
    reward: EstimatedReward | null;
    currency: Currency | null;
    /** `null` means the reward must be HIDDEN (`undefined` in TS). */
    formatted: string | null;
    formattedCodepoints: string[] | null;
};

type RewardValueFixture = FixtureBase & {
    kind: "reward-value";
    reward: EstimatedReward;
    currency: Currency | null;
    /** The `TokenAmountType` key the currency resolves to. */
    amountKey: keyof TokenAmountType;
    value: number;
    maxPercent: number;
    rank: number;
};

type SelectionOptions = {
    nowIso: string;
    currency: Currency | null;
    audience: "referrer" | "referee" | null;
    targetInteraction: string | null;
    products: ProductDetails[] | null;
};

type SelectDisplayCampaignFixture = FixtureBase & {
    kind: "select-display-campaign";
    campaigns: MerchantReward[];
    options: SelectionOptions;
    /** `null` when nothing should be displayed. */
    selected: {
        campaignId: string;
        status: "live" | "upcoming";
        startsAtIso: string | null;
        matchedProductIds: (string | undefined)[] | null;
    } | null;
};

type SelectBestRewardFixture = FixtureBase & {
    kind: "select-best-reward";
    campaigns: MerchantReward[];
    options: SelectionOptions;
    /** `null` when there is nothing worth showing. */
    best:
        | ({
              payoutType: EstimatedReward["payoutType"];
              minPurchaseAmount: string | null;
              minPurchaseAmountCodepoints: string[] | null;
              minPurchaseValue: number | null;
              lockupDurationDays: number | null;
              isProductScoped: boolean;
              matchedProductIds: (string | undefined)[] | null;
          } & FormattedExpectation)
        | null;
};

type Fixture =
    | FormatAmountFixture
    | FormatEstimatedRewardFixture
    | FormatRewardOrHideFixture
    | RewardValueFixture
    | SelectDisplayCampaignFixture
    | SelectBestRewardFixture;

// --- Hardcoded reward inputs -----------------------------------------------

/** Same value in every currency — used when the currency key is not the point. */
const flat = (value: number): TokenAmountType => ({
    amount: value,
    eurAmount: value,
    usdAmount: value,
    gbpAmount: value,
});

/** Deliberately different per currency, so a wrong `amountKey` cannot pass. */
const perCurrency = (
    eurAmount: number,
    usdAmount: number,
    gbpAmount: number
): TokenAmountType => ({
    amount: eurAmount,
    eurAmount,
    usdAmount,
    gbpAmount,
});

const fixedReward = (amount: TokenAmountType): EstimatedReward => ({
    payoutType: "fixed",
    amount,
});

const cappedPercentage = (
    percent: number,
    cap: TokenAmountType
): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
    maxAmount: cap,
});

const uncappedPercentage = (percent: number): EstimatedReward => ({
    payoutType: "percentage",
    percent,
    percentOf: "purchase_amount",
});

const tieredWithAmounts: EstimatedReward = {
    payoutType: "tiered",
    tierField: "purchase.amount",
    tiers: [
        { minValue: 0, maxValue: 50, amount: perCurrency(2, 2.2, 1.7) },
        { minValue: 50, maxValue: 200, amount: perCurrency(8, 8.8, 6.9) },
        { minValue: 200, amount: perCurrency(30, 33, 25.5) },
    ],
};

const tieredPercentOnly: EstimatedReward = {
    payoutType: "tiered",
    tierField: "purchase.amount",
    tiers: [
        { minValue: 0, maxValue: 50, percent: 5 },
        { minValue: 50, percent: 12 },
    ],
};

const tieredZeroAmount: EstimatedReward = {
    payoutType: "tiered",
    tierField: "purchase.amount",
    tiers: [
        { minValue: 0, maxValue: 50, amount: flat(0) },
        { minValue: 50, amount: flat(0) },
    ],
};

const tieredMixed: EstimatedReward = {
    payoutType: "tiered",
    tierField: "purchase.matchedAmount",
    tiers: [
        { minValue: 0, maxValue: 100, percent: 4 },
        { minValue: 100, amount: perCurrency(15, 16.5, 12.75) },
    ],
};

// --- Hardcoded campaign inputs ---------------------------------------------

const campaign = (opts: {
    id: string;
    interactionTypeKey?: MerchantReward["interactionTypeKey"];
    referrer?: EstimatedReward;
    referee?: EstimatedReward;
    conditions?: MerchantReward["conditions"];
    productScope?: MerchantReward["productScope"];
    expiresAt?: string | null;
    defaultLockupSeconds?: number;
}): MerchantReward => ({
    campaignId: opts.id,
    name: opts.id,
    interactionTypeKey: opts.interactionTypeKey ?? "purchase",
    referrer: opts.referrer,
    referee: opts.referee,
    conditions: opts.conditions ?? [],
    productScope: opts.productScope,
    expiresAt: opts.expiresAt ?? null,
    defaultLockupSeconds: opts.defaultLockupSeconds,
});

const startsAt = (iso: string): MerchantReward["conditions"] => [
    { field: "time.timestamp", operator: "gte", value: unix(iso) },
];

const minPurchase = (amount: number): MerchantReward["conditions"] => [
    { field: "purchase.amount", operator: "gte", value: amount },
];

/**
 * The shared live candidate set. `rich` wins on EUR (12 > 5) but LOSES on GBP
 * (8.5 < 9.4), so a native port that ignores the currency key cannot pass both
 * selection fixtures below.
 */
const LIVE_CANDIDATES: MerchantReward[] = [
    campaign({
        id: "campaign-modest",
        referrer: fixedReward(perCurrency(5, 5.5, 9.4)),
        referee: fixedReward(perCurrency(2, 2.2, 1.7)),
    }),
    campaign({
        id: "campaign-rich",
        referrer: fixedReward(perCurrency(12, 13.2, 8.5)),
        conditions: minPurchase(30),
        defaultLockupSeconds: 172_800, // 2 days
    }),
    campaign({
        id: "campaign-percent-only",
        referrer: uncappedPercentage(8),
    }),
    campaign({
        id: "campaign-expired",
        referrer: fixedReward(flat(100)),
        expiresAt: "2024-12-01T00:00:00.000Z",
    }),
    campaign({
        id: "campaign-referral-side-channel",
        interactionTypeKey: "referral",
        referrer: fixedReward(flat(3)),
    }),
];

const UPCOMING_CANDIDATES: MerchantReward[] = [
    campaign({
        id: "campaign-upcoming-late-but-rich",
        referrer: fixedReward(flat(90)),
        conditions: startsAt("2025-03-01T00:00:00.000Z"),
    }),
    campaign({
        id: "campaign-upcoming-soonest",
        referrer: fixedReward(flat(50)),
        conditions: startsAt("2025-02-01T00:00:00.000Z"),
    }),
];

/**
 * Both candidates are SCOPED, so the match-first grouping is actually
 * exercised: an unscoped campaign trivially "matches" and would make the
 * grouping indistinguishable from plain value ranking.
 */
const SCOPED_CANDIDATES: MerchantReward[] = [
    campaign({
        id: "campaign-scoped-rich-no-match",
        referrer: fixedReward(flat(20)),
        productScope: [{ field: "sku", operator: "eq", value: "SKU-NOPE" }],
    }),
    campaign({
        id: "campaign-scoped-modest-match",
        referrer: fixedReward(flat(6)),
        productScope: [{ field: "sku", operator: "eq", value: "SKU-42" }],
    }),
];

const PRODUCTS_MATCHING_SCOPE: ProductDetails[] = [
    { productId: "p-1", sku: "SKU-42", name: "Scoped item", quantity: 1 },
    { productId: "p-2", sku: "SKU-99", name: "Other item", quantity: 2 },
];

// --- Fixture builders ------------------------------------------------------

function formatAmountFixture(
    name: string,
    description: string,
    amount: number,
    currency: Currency | null
): FormatAmountFixture {
    return {
        name,
        description,
        kind: "format-amount",
        amount,
        currency,
        locale: getSupportedLocale(currency ?? undefined),
        ...expectString(formatAmount(amount, currency ?? undefined)),
    };
}

function formatEstimatedRewardFixture(
    name: string,
    description: string,
    reward: EstimatedReward,
    currency: Currency | null
): FormatEstimatedRewardFixture {
    return {
        name,
        description,
        kind: "format-estimated-reward",
        reward,
        currency,
        ...expectString(formatEstimatedReward(reward, currency ?? undefined)),
    };
}

function formatRewardOrHideFixture(
    name: string,
    description: string,
    reward: EstimatedReward | null,
    currency: Currency | null
): FormatRewardOrHideFixture {
    const result = formatRewardOrHide(
        reward ?? undefined,
        currency ?? undefined
    );
    return {
        name,
        description,
        kind: "format-reward-or-hide",
        reward,
        currency,
        formatted: result ?? null,
        formattedCodepoints: result != null ? codepoints(result) : null,
    };
}

function rewardValueFixture(
    name: string,
    description: string,
    reward: EstimatedReward,
    currency: Currency | null
): RewardValueFixture {
    const amountKey = getCurrencyAmountKey(
        getSupportedCurrency(currency ?? undefined)
    );
    return {
        name,
        description,
        kind: "reward-value",
        reward,
        currency,
        amountKey,
        value: getRewardValue(reward, amountKey),
        maxPercent: maxRewardPercent(reward),
        rank: getRewardRank(reward, amountKey),
    };
}

function toOptions(options: SelectionOptions): SelectDisplayCampaignOptions {
    return {
        now: new Date(options.nowIso),
        currency: options.currency ?? undefined,
        audience: options.audience ?? undefined,
        targetInteraction:
            (options.targetInteraction as
                | SelectDisplayCampaignOptions["targetInteraction"]
                | null) ?? undefined,
        products: options.products ?? undefined,
    };
}

function selectionOptions(
    overrides: Partial<SelectionOptions> = {}
): SelectionOptions {
    return {
        nowIso: FIXED_NOW_ISO,
        currency: null,
        audience: null,
        targetInteraction: null,
        products: null,
        ...overrides,
    };
}

const productIds = (products: ProductDetails[] | undefined) =>
    products ? products.map((product) => product.productId) : null;

function selectDisplayCampaignFixture(
    name: string,
    description: string,
    campaigns: MerchantReward[],
    options: SelectionOptions
): SelectDisplayCampaignFixture {
    const selected = selectDisplayCampaign(campaigns, toOptions(options));
    return {
        name,
        description,
        kind: "select-display-campaign",
        campaigns,
        options,
        selected: selected
            ? {
                  campaignId: selected.campaign.campaignId,
                  status: selected.status,
                  startsAtIso: selected.startsAt?.toISOString() ?? null,
                  matchedProductIds: productIds(selected.matchedProducts),
              }
            : null,
    };
}

function selectBestRewardFixture(
    name: string,
    description: string,
    campaigns: MerchantReward[],
    options: SelectionOptions
): SelectBestRewardFixture {
    const best = selectBestReward(campaigns, toOptions(options));
    return {
        name,
        description,
        kind: "select-best-reward",
        campaigns,
        options,
        best: best
            ? {
                  ...expectString(best.formatted),
                  payoutType: best.payoutType,
                  minPurchaseAmount: best.minPurchaseAmount ?? null,
                  minPurchaseAmountCodepoints:
                      best.minPurchaseAmount != null
                          ? codepoints(best.minPurchaseAmount)
                          : null,
                  minPurchaseValue: best.minPurchaseValue ?? null,
                  lockupDurationDays: best.lockupDurationDays ?? null,
                  isProductScoped: best.isProductScoped,
                  matchedProductIds: productIds(best.matchedProducts),
              }
            : null,
    };
}

// --- Corpus ----------------------------------------------------------------

/**
 * The five amounts every currency is exercised with: zero, a small integer, a
 * value with decimals, a large value crossing MULTIPLE group separators (the
 * ICU-fragile one), and a value that must round to 2 fraction digits.
 */
const AMOUNT_CASES: {
    slug: string;
    label: string;
    amount: number;
}[] = [
    { slug: "zero", label: "zero", amount: 0 },
    { slug: "small-integer", label: "a small integer", amount: 5 },
    { slug: "decimals", label: "a value with decimals", amount: 1234.56 },
    {
        slug: "large",
        label: "a large value crossing two group separators",
        amount: 1234567,
    },
    {
        slug: "rounds",
        label: "a value that rounds to two fraction digits",
        amount: 9876.5432,
    },
];

const CURRENCY_CASES: { currency: Currency; locale: string }[] = [
    { currency: "eur", locale: "fr-FR" },
    { currency: "usd", locale: "en-US" },
    { currency: "gbp", locale: "en-GB" },
];

function buildFixtures(): Fixture[] {
    const formatAmountFixtures: Fixture[] = CURRENCY_CASES.flatMap(
        ({ currency, locale }) =>
            AMOUNT_CASES.map((amountCase) =>
                formatAmountFixture(
                    `format-amount-${currency}-${amountCase.slug}`,
                    `formatAmount: ${currency}/${locale}, ${amountCase.label}`,
                    amountCase.amount,
                    currency
                )
            )
    );

    return [
        ...formatAmountFixtures,
        formatAmountFixture(
            "format-amount-default-currency",
            "formatAmount: no currency supplied, falls back to eur/fr-FR",
            1234.56,
            null
        ),

        // -- formatEstimatedReward -------------------------------------------
        formatEstimatedRewardFixture(
            "estimated-fixed-eur",
            "formatEstimatedReward: fixed reward in the default currency",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-fixed-usd",
            "formatEstimatedReward: the same fixed reward read through the usd amount key",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "usd"
        ),
        formatEstimatedRewardFixture(
            "estimated-fixed-gbp",
            "formatEstimatedReward: the same fixed reward read through the gbp amount key",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "gbp"
        ),
        formatEstimatedRewardFixture(
            "estimated-fixed-rounds-down",
            "formatEstimatedReward: fixed amount 5.4 rounds DOWN to 5 before formatting",
            fixedReward(flat(5.4)),
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-fixed-rounds-up",
            "formatEstimatedReward: fixed amount 5.6 rounds UP to 6 before formatting",
            fixedReward(flat(5.6)),
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-fixed-large",
            "formatEstimatedReward: large fixed reward, fr-FR group separators",
            fixedReward(flat(1234567)),
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-percentage-uncapped",
            "formatEstimatedReward: percentage renders as a percent string, never a basket amount",
            uncappedPercentage(8),
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-percentage-capped",
            "formatEstimatedReward: a capped percentage still renders as its percent, not the cap",
            cappedPercentage(10, perCurrency(50, 55, 42.5)),
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-tiered-amounts",
            "formatEstimatedReward: tiered picks the richest token tier",
            tieredWithAmounts,
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-tiered-amounts-gbp",
            "formatEstimatedReward: the same tiered reward through the gbp key, richest tier rounds",
            tieredWithAmounts,
            "gbp"
        ),
        formatEstimatedRewardFixture(
            "estimated-tiered-percent-only",
            "formatEstimatedReward: tiered with ONLY percentages falls back to the max percent",
            tieredPercentOnly,
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-tiered-mixed",
            "formatEstimatedReward: tiered mixing a percent tier and an amount tier prefers the amount",
            tieredMixed,
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-tiered-zero-amount",
            "formatEstimatedReward: tiered whose tiers are all zero-amount falls back to a formatted zero",
            tieredZeroAmount,
            "eur"
        ),
        formatEstimatedRewardFixture(
            "estimated-tiered-zero-amount-usd",
            "formatEstimatedReward: the zero-amount tiered fallback in usd",
            tieredZeroAmount,
            "usd"
        ),

        // -- formatRewardOrHide ----------------------------------------------
        formatRewardOrHideFixture(
            "hide-missing-reward",
            "formatRewardOrHide: no reward at all is hidden",
            null,
            "eur"
        ),
        formatRewardOrHideFixture(
            "hide-zero-fixed",
            "formatRewardOrHide: a fixed reward worth 0 is hidden",
            fixedReward(flat(0)),
            "eur"
        ),
        formatRewardOrHideFixture(
            "hide-zero-tiered",
            "formatRewardOrHide: an all-zero tiered reward is hidden",
            tieredZeroAmount,
            "eur"
        ),
        formatRewardOrHideFixture(
            "show-fixed",
            "formatRewardOrHide: a fixed reward carrying money value is shown",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "eur"
        ),
        formatRewardOrHideFixture(
            "show-uncapped-percentage",
            "formatRewardOrHide: an uncapped percentage is shown even though it has no money value",
            uncappedPercentage(8),
            "eur"
        ),
        formatRewardOrHideFixture(
            "show-capped-percentage",
            "formatRewardOrHide: a capped percentage is shown as its percent",
            cappedPercentage(10, perCurrency(50, 55, 42.5)),
            "eur"
        ),
        formatRewardOrHideFixture(
            "show-percent-only-tiered",
            "formatRewardOrHide: a percent-only tiered reward is shown, not hidden",
            tieredPercentOnly,
            "eur"
        ),

        // -- getRewardValue / maxRewardPercent / getRewardRank ----------------
        rewardValueFixture(
            "value-fixed-eur",
            "getRewardValue: fixed reward through the eur key",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "eur"
        ),
        rewardValueFixture(
            "value-fixed-usd",
            "getRewardValue: the same fixed reward through the usd key",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "usd"
        ),
        rewardValueFixture(
            "value-fixed-gbp",
            "getRewardValue: the same fixed reward through the gbp key",
            fixedReward(perCurrency(12, 13.2, 8.5)),
            "gbp"
        ),
        rewardValueFixture(
            "value-fixed-zero",
            "getRewardRank: a zero-value fixed reward ranks exactly 0",
            fixedReward(flat(0)),
            "eur"
        ),
        rewardValueFixture(
            "value-percentage-capped",
            "getRewardValue: a capped percentage is worth its cap",
            cappedPercentage(10, perCurrency(50, 55, 42.5)),
            "eur"
        ),
        rewardValueFixture(
            "value-percentage-uncapped",
            "getRewardRank: an uncapped percentage is worth 0 but ranks at percent * PERCENT_ONLY_RANK_WEIGHT (1e-6)",
            uncappedPercentage(8),
            "eur"
        ),
        rewardValueFixture(
            "value-tiered-amounts",
            "getRewardValue: tiered takes the richest token tier",
            tieredWithAmounts,
            "eur"
        ),
        rewardValueFixture(
            "value-tiered-amounts-gbp",
            "getRewardValue: the same tiered reward through the gbp key",
            tieredWithAmounts,
            "gbp"
        ),
        rewardValueFixture(
            "value-tiered-percent-only",
            "getRewardRank: a percent-only tiered reward ranks at maxPercent * 1e-6",
            tieredPercentOnly,
            "eur"
        ),
        rewardValueFixture(
            "value-tiered-mixed",
            "getRewardValue: a mixed tiered reward ignores percent tiers for its money value",
            tieredMixed,
            "eur"
        ),
        rewardValueFixture(
            "value-tiered-zero",
            "getRewardRank: an all-zero tiered reward ranks 0 and is therefore hidden",
            tieredZeroAmount,
            "eur"
        ),

        // -- selectDisplayCampaign -------------------------------------------
        selectDisplayCampaignFixture(
            "select-campaign-live-richest",
            "selectDisplayCampaign: picks the richest live campaign, skipping the expired one",
            LIVE_CANDIDATES,
            selectionOptions()
        ),
        selectDisplayCampaignFixture(
            "select-campaign-live-richest-gbp",
            "selectDisplayCampaign: ranking in gbp flips the winner, because the amount key differs",
            LIVE_CANDIDATES,
            selectionOptions({ currency: "gbp" })
        ),
        selectDisplayCampaignFixture(
            "select-campaign-referee-audience",
            "selectDisplayCampaign: ranking by the referee side ignores campaigns with no referee reward",
            LIVE_CANDIDATES,
            selectionOptions({ audience: "referee" })
        ),
        selectDisplayCampaignFixture(
            "select-campaign-target-interaction",
            "selectDisplayCampaign: targetInteraction filters down to the referral campaign",
            LIVE_CANDIDATES,
            selectionOptions({ targetInteraction: "referral" })
        ),
        selectDisplayCampaignFixture(
            "select-campaign-empty",
            "selectDisplayCampaign: an empty candidate set selects nothing",
            [],
            selectionOptions()
        ),
        selectDisplayCampaignFixture(
            "select-campaign-all-expired",
            "selectDisplayCampaign: every candidate expired at the pinned now, so nothing is selected",
            [
                campaign({
                    id: "campaign-expired",
                    referrer: fixedReward(flat(100)),
                    expiresAt: "2024-12-01T00:00:00.000Z",
                }),
            ],
            selectionOptions()
        ),
        selectDisplayCampaignFixture(
            "select-campaign-upcoming-soonest",
            "selectDisplayCampaign: with no live campaign it falls back to the SOONEST upcoming, not the richest",
            UPCOMING_CANDIDATES,
            selectionOptions()
        ),
        selectDisplayCampaignFixture(
            "select-campaign-live-beats-richer-upcoming",
            "selectDisplayCampaign: a modest live campaign beats a far richer upcoming one",
            [...UPCOMING_CANDIDATES, LIVE_CANDIDATES[0] as MerchantReward],
            selectionOptions()
        ),
        selectDisplayCampaignFixture(
            "select-campaign-product-match-wins",
            "selectDisplayCampaign: a product-matching scoped campaign outranks a richer scoped one that matches nothing",
            SCOPED_CANDIDATES,
            selectionOptions({ products: PRODUCTS_MATCHING_SCOPE })
        ),
        selectDisplayCampaignFixture(
            "select-campaign-no-product-context",
            "selectDisplayCampaign: without product context the grouping is inert and the richer campaign wins",
            SCOPED_CANDIDATES,
            selectionOptions()
        ),

        // -- selectBestReward -------------------------------------------------
        selectBestRewardFixture(
            "best-reward-live-richest",
            "selectBestReward: richest live campaign, with its minimum purchase and lockup",
            LIVE_CANDIDATES,
            selectionOptions()
        ),
        selectBestRewardFixture(
            "best-reward-live-richest-gbp",
            "selectBestReward: the gbp ranking picks a different campaign and formats in en-GB",
            LIVE_CANDIDATES,
            selectionOptions({ currency: "gbp" })
        ),
        selectBestRewardFixture(
            "best-reward-referee-audience",
            "selectBestReward: the referee side of the only campaign that defines one",
            LIVE_CANDIDATES,
            selectionOptions({ audience: "referee" })
        ),
        selectBestRewardFixture(
            "best-reward-percentage-only",
            "selectBestReward: a percentage-only candidate set still yields a percent string",
            [
                campaign({
                    id: "campaign-percent-only",
                    referrer: uncappedPercentage(8),
                }),
                campaign({
                    id: "campaign-zero-fixed",
                    referrer: fixedReward(flat(0)),
                }),
            ],
            selectionOptions()
        ),
        selectBestRewardFixture(
            "best-reward-all-zero-value",
            "selectBestReward: every candidate is worth 0, so there is nothing worth showing",
            [
                campaign({
                    id: "campaign-zero-fixed",
                    referrer: fixedReward(flat(0)),
                }),
            ],
            selectionOptions()
        ),
        selectBestRewardFixture(
            "best-reward-no-audience-reward",
            "selectBestReward: the selected campaign has no reward on the requested side",
            [campaign({ id: "campaign-referrer-only", referrer: undefined })],
            selectionOptions()
        ),
        selectBestRewardFixture(
            "best-reward-upcoming",
            "selectBestReward: resolves the soonest upcoming campaign when none is live",
            UPCOMING_CANDIDATES,
            selectionOptions()
        ),
        selectBestRewardFixture(
            "best-reward-product-scoped",
            "selectBestReward: a scoped winner reports isProductScoped and its matched products",
            SCOPED_CANDIDATES,
            selectionOptions({ products: PRODUCTS_MATCHING_SCOPE })
        ),
        selectBestRewardFixture(
            "best-reward-tiered",
            "selectBestReward: a tiered campaign reports payoutType tiered and its richest tier",
            [
                campaign({
                    id: "campaign-tiered",
                    referrer: tieredWithAmounts,
                    conditions: minPurchase(1500),
                }),
            ],
            selectionOptions()
        ),
    ];
}

/**
 * Escape every codepoint above U+007F as `\uXXXX` so the corpus is pure ASCII.
 * See the header: this is what makes the invisible ICU spaces reviewable in a
 * diff, and it must be preserved by any future generator.
 */
function toAsciiJson(value: unknown): string {
    return JSON.stringify(value, null, 4).replace(
        /[\u0080-\uffff]/g,
        (char) => `\\u${char.charCodeAt(0).toString(16).padStart(4, "0")}`
    );
}

async function main() {
    const fixtures = buildFixtures();

    const names = new Set(fixtures.map((fixture) => fixture.name));
    if (names.size !== fixtures.length) {
        throw new Error("fixture `name` values must be unique");
    }

    const output = {
        // Bump if the fixture payload shape changes. Consumers should assert
        // this matches their own expected format version.
        formatVersion: 1,
        fixtures,
    };

    const outPath = new URL(
        "../src/rewards/fixtures/golden-rewards.json",
        import.meta.url
    );
    await Bun.write(outPath, `${toAsciiJson(output)}\n`);
    console.log(`Wrote ${fixtures.length} fixtures to ${outPath.pathname}`);
}

main();
