import { campaignRulesTable } from "@frak-labs/backend-elysia/domain/campaign";
import {
    merchantAdminsTable,
    merchantsTable,
} from "@frak-labs/backend-elysia/domain/merchant";
import { db } from "@frak-labs/backend-elysia/infrastructure";
import { eq } from "drizzle-orm";
import type {
    V2CampaignRuleInsert,
    V2MerchantAdminInsert,
    V2MerchantInsert,
} from "../types";

export async function insertMerchant(
    merchant: V2MerchantInsert
): Promise<string> {
    const [result] = await db
        .insert(merchantsTable)
        .values({
            productId: merchant.productId,
            domain: merchant.domain,
            name: merchant.name,
            ownerWallet: merchant.ownerWallet,
            bankAddress: merchant.bankAddress,
            defaultRewardToken: merchant.defaultRewardToken,
            verifiedAt: merchant.verifiedAt,
            createdAt: merchant.createdAt,
        })
        .returning({ id: merchantsTable.id });

    if (!result)
        throw new Error(`Failed to insert merchant ${merchant.domain}`);
    return result.id;
}

export async function insertMerchantAdmin(
    admin: V2MerchantAdminInsert
): Promise<string> {
    const [result] = await db
        .insert(merchantAdminsTable)
        .values({
            merchantId: admin.merchantId,
            wallet: admin.wallet,
            addedBy: admin.addedBy,
            addedAt: admin.addedAt,
        })
        .returning({ id: merchantAdminsTable.id });

    if (!result)
        throw new Error(`Failed to insert merchant admin ${admin.wallet}`);
    return result.id;
}

export async function insertCampaignRule(
    rule: V2CampaignRuleInsert
): Promise<string> {
    const [result] = await db
        .insert(campaignRulesTable)
        .values({
            merchantId: rule.merchantId,
            name: rule.name,
            status: rule.status,
            priority: rule.priority,
            rule: rule.rule,
            metadata: rule.metadata,
            budgetConfig: rule.budgetConfig,
            expiresAt: rule.expiresAt,
            publishedAt: rule.publishedAt,
        })
        .returning({ id: campaignRulesTable.id });

    if (!result) throw new Error(`Failed to insert campaign rule ${rule.name}`);
    return result.id;
}

export async function findMerchantByDomain(
    domain: string
): Promise<{ id: string } | null> {
    const result = await db.query.merchantsTable.findFirst({
        where: eq(merchantsTable.domain, domain),
        columns: { id: true },
    });
    return result ?? null;
}

export async function findMerchantByProductId(
    productId: string
): Promise<{ id: string; bankAddress: string | null } | null> {
    const result = await db.query.merchantsTable.findFirst({
        where: eq(merchantsTable.productId, productId as `0x${string}`),
        columns: { id: true, bankAddress: true },
    });
    return result ?? null;
}
