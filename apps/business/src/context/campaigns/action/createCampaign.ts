import { createServerFn } from "@tanstack/react-start";
import { authenticatedBackendApi } from "@/context/api/backendClient";
import { authMiddleware } from "@/context/auth/authMiddleware";
import type {
    BudgetConfig,
    Campaign,
    CampaignMetadata,
    CampaignRuleDefinition,
} from "@/types/Campaign";

// ============================================================================
// FIAT CONVERSION PIPELINE:
// 1. Form collects fiat amount (e.g., €5.00)
// 2. getBankInfo() fetches token exchange rate and decimals
// 3. Apply 20% Frak commission: fiatAmount * 0.8
// 4. Convert to token: (fiatAmount * 0.8) * exchangeRate * 10^decimals
// 5. Final token amount sent to backend as reward.amount
//
// Fiat-to-token conversion happens in the form/UI layer BEFORE
// calling createCampaign(). The reward amounts arriving here are already
// converted to token amounts. See getBankInfo.ts for the conversion utils.
// ============================================================================

type CreateCampaignInput = {
    merchantId: string;
    name: string;
    rule: CampaignRuleDefinition;
    metadata?: CampaignMetadata;
    budgetConfig?: BudgetConfig;
    expiresAt?: string;
    priority?: number;
};

async function createCampaignInternal(
    input: CreateCampaignInput
): Promise<Campaign> {
    const { merchantId, ...body } = input;

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns.post(body);

    if (!data || error) {
        throw new Error(
            `Failed to create campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }

    return data as Campaign;
}

export const createCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: CreateCampaignInput) => input)
    .handler(async ({ data }) => {
        return createCampaignInternal(data);
    });

type UpdateCampaignInput = {
    merchantId: string;
    campaignId: string;
    name?: string;
    rule?: CampaignRuleDefinition;
    metadata?: CampaignMetadata;
    budgetConfig?: BudgetConfig;
    expiresAt?: string | null;
    priority?: number;
};

async function updateCampaignInternal(
    input: UpdateCampaignInput
): Promise<Campaign> {
    const { merchantId, campaignId, ...body } = input;

    const { data, error } = await authenticatedBackendApi
        .merchant({ merchantId })
        .campaigns({ campaignId })
        .put(body);

    if (!data || error) {
        throw new Error(
            `Failed to update campaign: ${error?.toString() ?? "Unknown error"}`
        );
    }

    return data as Campaign;
}

export const updateCampaign = createServerFn({ method: "POST" })
    .middleware([authMiddleware])
    .inputValidator((input: UpdateCampaignInput) => input)
    .handler(async ({ data }) => {
        return updateCampaignInternal(data);
    });
