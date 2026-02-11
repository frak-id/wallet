import { campaignRulesTable } from "@backend/domain/campaign/db/schema";
import {
    merchantAdminsTable,
    merchantsTable,
} from "@backend/domain/merchant/db/schema";
import { db } from "@backend/infrastructure/persistence/postgres";
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
        .values(merchant)
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
        .values(admin)
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
        .values(rule)
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
