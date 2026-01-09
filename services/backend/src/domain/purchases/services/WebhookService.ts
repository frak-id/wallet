import { db, log } from "@backend-infrastructure";
import { purchaseItemsTable, purchasesTable } from "../db/schema";
import { PurchaseLinkingService } from "./LinkingService";

type PurchaseInsert = Omit<typeof purchasesTable.$inferInsert, "id">;
type PurchaseItemInsert = Omit<
    typeof purchaseItemsTable.$inferInsert,
    "id" | "purchaseId"
>;

type UpsertPurchaseParams = {
    purchase: PurchaseInsert;
    purchaseItems: PurchaseItemInsert[];
    merchantId: string;
};

type UpsertPurchaseResult = {
    purchaseId: string;
    identityGroupId?: string;
    rewardsProcessed: boolean;
};

export class PurchasesWebhookService {
    private readonly linkingService: PurchaseLinkingService;

    constructor(linkingService?: PurchaseLinkingService) {
        this.linkingService = linkingService ?? new PurchaseLinkingService();
    }

    async upsertPurchase({
        purchase,
        purchaseItems,
        merchantId,
    }: UpsertPurchaseParams): Promise<UpsertPurchaseResult> {
        const pendingIdentity =
            await this.linkingService.checkPendingIdentityForPurchase({
                customerId: purchase.externalCustomerId,
                orderId: purchase.externalId,
                token: purchase.purchaseToken ?? "",
                merchantId,
            });

        const identityGroupId = pendingIdentity?.identityGroupId;

        const purchaseId = await db.transaction(async (trx) => {
            const inserted = await trx
                .insert(purchasesTable)
                .values({
                    ...purchase,
                    identityGroupId,
                })
                .onConflictDoUpdate({
                    target: [
                        purchasesTable.externalId,
                        purchasesTable.webhookId,
                    ],
                    set: {
                        status: purchase.status,
                        totalPrice: purchase.totalPrice,
                        currencyCode: purchase.currencyCode,
                        updatedAt: new Date(),
                        ...(purchase.purchaseToken
                            ? { purchaseToken: purchase.purchaseToken }
                            : {}),
                        ...(identityGroupId ? { identityGroupId } : {}),
                    },
                })
                .returning({ purchaseId: purchasesTable.id });

            const dbId = inserted[0]?.purchaseId;
            if (!dbId) {
                throw new Error("Failed to insert purchase");
            }

            if (purchaseItems.length > 0) {
                await trx
                    .insert(purchaseItemsTable)
                    .values(
                        purchaseItems.map((item) => ({
                            ...item,
                            purchaseId: dbId,
                        }))
                    )
                    .onConflictDoNothing();
            }

            return dbId;
        });

        log.debug(
            {
                purchaseId,
                identityGroupId,
                hasPendingIdentity: !!pendingIdentity,
            },
            "Purchase upserted"
        );

        let rewardsProcessed = false;

        if (identityGroupId) {
            const result =
                await this.linkingService.processRewardsForLinkedPurchase(
                    purchaseId
                );
            rewardsProcessed = result.rewardsCreated > 0;

            log.info(
                {
                    purchaseId,
                    identityGroupId,
                    rewardsCreated: result.rewardsCreated,
                },
                "Processed rewards for purchase with pending identity"
            );
        }

        return {
            purchaseId,
            identityGroupId,
            rewardsProcessed,
        };
    }
}
