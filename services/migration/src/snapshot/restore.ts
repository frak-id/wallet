import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
    identityGroupsTable,
    identityNodesTable,
} from "@backend/domain/identity/db/schema";
import { merchantsTable } from "@backend/domain/merchant/db/schema";
import {
    merchantWebhooksTable,
    purchaseClaimsTable,
    purchaseItemsTable,
    purchasesTable,
} from "@backend/domain/purchases/db/schema";
import { db } from "@backend/infrastructure/persistence/postgres";
import { and, eq } from "drizzle-orm";
import type { Address, Hex } from "viem";
import type {
    OldProductOracle,
    OldPurchase,
    OldPurchaseItem,
    OldPurchaseTracker,
    OracleSnapshot,
} from "./types";

const dryRun = process.env.DRY_RUN !== "false";
const stage = process.env.STAGE ?? "dev";

type RestoreResult = {
    webhooksCreated: number;
    webhooksSkipped: number;
    purchasesCreated: number;
    purchasesSkipped: number;
    purchaseItemsCreated: number;
    purchaseItemsSkipped: number;
    claimsCreated: number;
    claimsSkipped: number;
    errors: string[];
};

function loadSnapshot(): OracleSnapshot {
    const snapshotPath =
        process.env.SNAPSHOT_PATH ??
        join(
            import.meta.dir,
            "..",
            "..",
            "snapshots",
            `oracle-snapshot-${stage}-latest.json`
        );

    console.log(`[restore] Loading snapshot from ${snapshotPath}`);
    const raw = readFileSync(snapshotPath, "utf-8");
    const snapshot = JSON.parse(raw) as OracleSnapshot;

    if (snapshot.snapshotVersion !== 1) {
        throw new Error(
            `Unsupported snapshot version: ${snapshot.snapshotVersion}`
        );
    }

    console.log(
        `[restore] Snapshot loaded (stage: ${snapshot.stage}, created: ${snapshot.createdAt})`
    );
    return snapshot;
}

async function findMerchantByProductId(
    productId: Hex
): Promise<{ id: string } | undefined> {
    return db.query.merchantsTable.findFirst({
        where: eq(merchantsTable.productId, productId),
        columns: { id: true },
    });
}

async function findOrCreateIdentityGroupForWallet(
    wallet: Address
): Promise<string> {
    const existingNode = await db.query.identityNodesTable.findFirst({
        where: and(
            eq(identityNodesTable.identityType, "wallet"),
            eq(identityNodesTable.identityValue, wallet.toLowerCase())
        ),
        columns: { groupId: true },
    });

    if (existingNode) {
        return existingNode.groupId;
    }

    return db.transaction(async (trx) => {
        const [group] = await trx
            .insert(identityGroupsTable)
            .values({})
            .returning({ id: identityGroupsTable.id });

        if (!group) {
            throw new Error(
                `Failed to create identity group for wallet ${wallet}`
            );
        }

        await trx.insert(identityNodesTable).values({
            groupId: group.id,
            identityType: "wallet",
            identityValue: wallet.toLowerCase(),
        });

        return group.id;
    });
}

async function restoreWebhooks(
    oracles: OldProductOracle[],
    result: RestoreResult
): Promise<Map<number, number>> {
    const oracleToWebhookMap = new Map<number, number>();

    for (const oracle of oracles) {
        const merchant = await findMerchantByProductId(
            oracle.product_id as Hex
        );

        if (!merchant) {
            result.errors.push(
                `No merchant found for product_id ${oracle.product_id} (oracle ${oracle.id}), skipping webhook`
            );
            result.webhooksSkipped++;
            continue;
        }

        if (dryRun) {
            console.log(
                `[dry-run] Would create webhook: merchant=${merchant.id}, platform=${oracle.platform}`
            );
            result.webhooksSkipped++;
            continue;
        }

        const [inserted] = await db
            .insert(merchantWebhooksTable)
            .values({
                merchantId: merchant.id,
                hookSignatureKey: oracle.hook_signature_key,
                platform: oracle.platform,
                createdAt: oracle.created_at
                    ? new Date(oracle.created_at)
                    : undefined,
            })
            .onConflictDoNothing()
            .returning({ id: merchantWebhooksTable.id });

        if (inserted) {
            oracleToWebhookMap.set(oracle.id, inserted.id);
            result.webhooksCreated++;
            console.log(
                `[restore] Created webhook ${inserted.id} for oracle ${oracle.id} (merchant ${merchant.id})`
            );
        } else {
            const existing = await db.query.merchantWebhooksTable.findFirst({
                where: eq(merchantWebhooksTable.merchantId, merchant.id),
                columns: { id: true },
            });
            if (existing) {
                oracleToWebhookMap.set(oracle.id, existing.id);
            }
            result.webhooksSkipped++;
        }
    }

    return oracleToWebhookMap;
}

async function restorePurchases(
    purchases: OldPurchase[],
    oracleToWebhookMap: Map<number, number>,
    result: RestoreResult
): Promise<Map<string, string>> {
    const purchaseIdMap = new Map<string, string>();

    for (const purchase of purchases) {
        const webhookId = oracleToWebhookMap.get(purchase.oracle_id);
        if (!webhookId) {
            result.errors.push(
                `No webhook mapping for oracle_id ${purchase.oracle_id} (purchase ${purchase.id}), skipping`
            );
            result.purchasesSkipped++;
            continue;
        }

        if (dryRun) {
            console.log(
                `[dry-run] Would create purchase: external_id=${purchase.external_id}, webhook=${webhookId}`
            );
            result.purchasesSkipped++;
            continue;
        }

        const [inserted] = await db
            .insert(purchasesTable)
            .values({
                webhookId,
                externalId: purchase.external_id,
                externalCustomerId: purchase.external_customer_id,
                purchaseToken: purchase.purchase_token,
                totalPrice: purchase.total_price,
                currencyCode: purchase.currency_code,
                status: purchase.status,
                createdAt: purchase.created_at
                    ? new Date(purchase.created_at)
                    : undefined,
                updatedAt: purchase.updated_at
                    ? new Date(purchase.updated_at)
                    : undefined,
            })
            .onConflictDoNothing()
            .returning({ id: purchasesTable.id });

        if (inserted) {
            purchaseIdMap.set(purchase.purchase_id, inserted.id);
            result.purchasesCreated++;
        } else {
            const existing = await db.query.purchasesTable.findFirst({
                where: and(
                    eq(purchasesTable.externalId, purchase.external_id),
                    eq(purchasesTable.webhookId, webhookId)
                ),
                columns: { id: true },
            });
            if (existing) {
                purchaseIdMap.set(purchase.purchase_id, existing.id);
            }
            result.purchasesSkipped++;
        }
    }

    return purchaseIdMap;
}

async function restorePurchaseItems(
    items: OldPurchaseItem[],
    purchaseIdMap: Map<string, string>,
    result: RestoreResult
): Promise<void> {
    for (const item of items) {
        const newPurchaseId = purchaseIdMap.get(item.purchase_id);
        if (!newPurchaseId) {
            result.errors.push(
                `No purchase mapping for old purchase_id ${item.purchase_id} (item ${item.id}), skipping`
            );
            result.purchaseItemsSkipped++;
            continue;
        }

        if (dryRun) {
            console.log(
                `[dry-run] Would create purchase item: external_id=${item.external_id}, purchase=${newPurchaseId}`
            );
            result.purchaseItemsSkipped++;
            continue;
        }

        const [inserted] = await db
            .insert(purchaseItemsTable)
            .values({
                purchaseId: newPurchaseId,
                externalId: item.external_id,
                price: item.price,
                name: item.name,
                title: item.title,
                imageUrl: item.image_url,
                quantity: item.quantity,
                createdAt: item.created_at
                    ? new Date(item.created_at)
                    : undefined,
            })
            .onConflictDoNothing()
            .returning({ id: purchaseItemsTable.id });

        if (inserted) {
            result.purchaseItemsCreated++;
        } else {
            result.purchaseItemsSkipped++;
        }
    }
}

async function restorePurchaseClaims(
    trackers: OldPurchaseTracker[],
    result: RestoreResult
): Promise<void> {
    for (const tracker of trackers) {
        const existingPurchase = await db.query.purchasesTable.findFirst({
            where: and(
                eq(purchasesTable.externalId, tracker.external_purchase_id),
                eq(purchasesTable.purchaseToken, tracker.token)
            ),
            columns: { webhookId: true },
        });

        if (!existingPurchase) {
            result.errors.push(
                `No matching purchase for tracker ${tracker.id} (external_purchase_id=${tracker.external_purchase_id}, token=${tracker.token}), skipping claim`
            );
            result.claimsSkipped++;
            continue;
        }

        const webhook = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.id, existingPurchase.webhookId),
            columns: { merchantId: true },
        });

        if (!webhook) {
            result.errors.push(
                `No webhook found for webhookId ${existingPurchase.webhookId} (tracker ${tracker.id}), skipping claim`
            );
            result.claimsSkipped++;
            continue;
        }

        if (dryRun) {
            console.log(
                `[dry-run] Would create claim: merchant=${webhook.merchantId}, order=${tracker.external_purchase_id}, wallet=${tracker.wallet}`
            );
            result.claimsSkipped++;
            continue;
        }

        const identityGroupId = await findOrCreateIdentityGroupForWallet(
            tracker.wallet as Address
        );

        const [inserted] = await db
            .insert(purchaseClaimsTable)
            .values({
                merchantId: webhook.merchantId,
                customerId: tracker.external_customer_id,
                orderId: tracker.external_purchase_id,
                purchaseToken: tracker.token,
                claimingIdentityGroupId: identityGroupId,
                createdAt: tracker.created_at
                    ? new Date(tracker.created_at)
                    : undefined,
            })
            .onConflictDoNothing()
            .returning({ id: purchaseClaimsTable.id });

        if (inserted) {
            result.claimsCreated++;
            console.log(
                `[restore] Created claim ${inserted.id} for tracker ${tracker.id}`
            );
        } else {
            result.claimsSkipped++;
        }
    }
}

export async function restoreFromSnapshot(): Promise<void> {
    const snapshot = loadSnapshot();

    console.log(`[restore] Running in ${dryRun ? "DRY RUN" : "LIVE"} mode`);

    const result: RestoreResult = {
        webhooksCreated: 0,
        webhooksSkipped: 0,
        purchasesCreated: 0,
        purchasesSkipped: 0,
        purchaseItemsCreated: 0,
        purchaseItemsSkipped: 0,
        claimsCreated: 0,
        claimsSkipped: 0,
        errors: [],
    };

    console.log(
        `[restore] Phase 1/4: Restoring ${snapshot.counts.productOracles} webhooks...`
    );
    const oracleToWebhookMap = await restoreWebhooks(
        snapshot.tables.productOracles,
        result
    );

    console.log(
        `[restore] Phase 2/4: Restoring ${snapshot.counts.purchases} purchases...`
    );
    const purchaseIdMap = await restorePurchases(
        snapshot.tables.purchases,
        oracleToWebhookMap,
        result
    );

    console.log(
        `[restore] Phase 3/4: Restoring ${snapshot.counts.purchaseItems} purchase items...`
    );
    await restorePurchaseItems(
        snapshot.tables.purchaseItems,
        purchaseIdMap,
        result
    );

    console.log(
        `[restore] Phase 4/4: Restoring ${snapshot.counts.purchaseTrackers} purchase claims...`
    );
    await restorePurchaseClaims(snapshot.tables.purchaseTrackers, result);

    printRestoreResult(result);
}

function printRestoreResult(result: RestoreResult): void {
    console.log(`\n${"=".repeat(60)}`);
    console.log(`RESTORE RESULT ${dryRun ? "(DRY RUN)" : "(LIVE)"}`);
    console.log("=".repeat(60));
    console.log(
        `Webhooks: ${result.webhooksCreated} created, ${result.webhooksSkipped} skipped`
    );
    console.log(
        `Purchases: ${result.purchasesCreated} created, ${result.purchasesSkipped} skipped`
    );
    console.log(
        `Purchase Items: ${result.purchaseItemsCreated} created, ${result.purchaseItemsSkipped} skipped`
    );
    console.log(
        `Claims: ${result.claimsCreated} created, ${result.claimsSkipped} skipped`
    );
    if (result.errors.length > 0) {
        console.log(`\nErrors (${result.errors.length}):`);
        for (const e of result.errors) {
            console.log(`  - ${e}`);
        }
    }
    console.log(`${"=".repeat(60)}\n`);
}

if (import.meta.main) {
    restoreFromSnapshot()
        .then(() => {
            console.log("[restore] Done");
            process.exit(0);
        })
        .catch((error) => {
            console.error("[restore] Failed:", error);
            process.exit(1);
        });
}
