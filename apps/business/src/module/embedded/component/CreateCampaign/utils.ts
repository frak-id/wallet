import type {
    BudgetConfig,
    CampaignRule,
    CampaignTrigger,
    FixedReward,
} from "@/types/Campaign";

const WEEK_IN_SECONDS = 7 * 24 * 60 * 60;
const MONTH_IN_SECONDS = 30 * 24 * 60 * 60;

function parseBudgetConfig({
    weeklyBudget,
    monthlyBudget,
    globalBudget,
}: {
    weeklyBudget: string | null;
    monthlyBudget: string | null;
    globalBudget: string | null;
}): BudgetConfig {
    if (weeklyBudget && Number.isNaN(Number(weeklyBudget))) {
        throw new Error("Invalid weekly budget");
    }
    if (monthlyBudget && Number.isNaN(Number(monthlyBudget))) {
        throw new Error("Invalid monthly budget");
    }
    if (globalBudget && Number.isNaN(Number(globalBudget))) {
        throw new Error("Invalid global budget");
    }

    const budgetCount = [weeklyBudget, monthlyBudget, globalBudget].filter(
        Boolean
    ).length;

    if (budgetCount === 0) {
        throw new Error("Missing required budget parameters");
    }
    if (budgetCount > 1) {
        throw new Error("Only one budget can be provided");
    }

    if (weeklyBudget) {
        return [
            {
                label: "weekly",
                durationInSeconds: WEEK_IN_SECONDS,
                amount: Number(weeklyBudget),
            },
        ];
    }

    if (monthlyBudget) {
        return [
            {
                label: "monthly",
                durationInSeconds: MONTH_IN_SECONDS,
                amount: Number(monthlyBudget),
            },
        ];
    }

    return [
        {
            label: "global",
            durationInSeconds: null,
            amount: Number(globalBudget),
        },
    ];
}

export type ExtractedSearchParams = {
    name: string;
    bankId: string;
    domain: string;
    merchantId: string;
    budgetConfig: BudgetConfig;
    cacBrut: number;
    ratio: number;
    setupCurrency?: "eur" | "usd" | "gbp" | "raw";
};

export function extractSearchParams(search: {
    n: string;
    bid: string;
    d: string;
    mid: string;
    cac: string;
    r: string;
    sc?: string;
    wb?: string;
    mb?: string;
    gb?: string;
}): ExtractedSearchParams {
    const name = search.n;
    // bid: bank address for fiat conversion — kept for backwards compat, not sent to backend
    const bankId = search.bid;
    const domain = search.d;
    const merchantId = search.mid;
    const cacBrut = search.cac;
    const ratio = search.r;
    const setupCurrency = search.sc;
    const weeklyBudget = search.wb ?? null;
    const monthlyBudget = search.mb ?? null;
    const globalBudget = search.gb ?? null;

    if (!name || !domain || !merchantId || !cacBrut || !ratio) {
        throw new Error("Missing required parameters");
    }

    if (Number.isNaN(Number(cacBrut))) {
        throw new Error("Invalid cac brut");
    }

    if (Number.isNaN(Number(ratio))) {
        throw new Error("Invalid ratio");
    }

    if (
        setupCurrency &&
        !["eur", "usd", "gbp", "raw"].includes(setupCurrency)
    ) {
        throw new Error("Invalid setup currency");
    }

    return {
        name,
        bankId: bankId ?? "",
        domain,
        merchantId,
        budgetConfig: parseBudgetConfig({
            weeklyBudget,
            monthlyBudget,
            globalBudget,
        }),
        cacBrut: Number(cacBrut),
        ratio: Number(ratio),
        setupCurrency: setupCurrency as
            | "eur"
            | "usd"
            | "gbp"
            | "raw"
            | undefined,
    };
}

export function buildCampaignRule({
    cacBrut,
    ratio,
}: {
    cacBrut: number;
    ratio: number;
}): CampaignRule {
    const referrerPercent = ratio / 100;
    const refereePercent = 1 - referrerPercent;

    const rewards: FixedReward[] = [];

    if (referrerPercent > 0) {
        const referrerReward: FixedReward = {
            recipient: "referrer",
            type: "token",
            amountType: "fixed",
            amount: Math.round(cacBrut * referrerPercent * 100) / 100,
            description: "Referrer reward",
        };
        rewards.push(referrerReward);
    }

    if (refereePercent > 0) {
        const refereeReward: FixedReward = {
            recipient: "referee",
            type: "token",
            amountType: "fixed",
            amount: Math.round(cacBrut * refereePercent * 100) / 100,
            description: "Referee reward",
        };
        rewards.push(refereeReward);
    }

    return {
        trigger: "purchase" as CampaignTrigger,
        conditions: [],
        rewards,
    };
}
