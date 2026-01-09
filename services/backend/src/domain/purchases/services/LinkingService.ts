import { db, log } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import { IdentityResolutionService } from "../../identity/services/IdentityResolutionService";
import { RewardProcessingService } from "../../rewards/services/RewardProcessingService";
import {
    merchantWebhooksTable,
    purchaseItemsTable,
    purchasesTable,
} from "../db/schema";

type PurchaseLinkParams = {
    customerId: string;
    orderId: string;
    token: string;
};

type PurchaseLinkResult = {
    success: boolean;
    purchaseId?: string;
    identityGroupId?: string;
    rewardsCreated?: number;
    error?: string;
};

export class PurchaseLinkingService {
    private readonly identityService: IdentityResolutionService;
    private readonly rewardService: RewardProcessingService;

    constructor(
        identityService?: IdentityResolutionService,
        rewardService?: RewardProcessingService
    ) {
        this.identityService =
            identityService ?? new IdentityResolutionService();
        this.rewardService = rewardService ?? new RewardProcessingService();
    }

    async linkPurchaseByClientId(
        params: PurchaseLinkParams & {
            clientId: string;
            merchantId: string;
        }
    ): Promise<PurchaseLinkResult> {
        const { identityGroupId } =
            await this.identityService.resolveAnonymousId({
                anonId: params.clientId,
                merchantId: params.merchantId,
            });

        return this.linkPurchaseToIdentity({
            ...params,
            identityGroupId,
        });
    }

    async linkPurchaseByWallet(
        params: PurchaseLinkParams & {
            wallet: Address;
            merchantId?: string;
            clientId?: string;
        }
    ): Promise<PurchaseLinkResult> {
        const { identityGroupId } = await this.identityService.connectWallet({
            wallet: params.wallet,
            clientId: params.clientId,
            merchantId: params.merchantId,
        });

        return this.linkPurchaseToIdentity({
            ...params,
            identityGroupId,
            merchantId: params.merchantId,
        });
    }

    private async linkPurchaseToIdentity(
        params: PurchaseLinkParams & {
            identityGroupId: string;
            merchantId?: string;
        }
    ): Promise<PurchaseLinkResult> {
        const purchase = await db.query.purchasesTable.findFirst({
            where: and(
                eq(purchasesTable.externalId, params.orderId),
                eq(purchasesTable.purchaseToken, params.token)
            ),
        });

        if (!purchase) {
            log.debug(
                { orderId: params.orderId, token: params.token },
                "Purchase not found for linking"
            );
            return { success: false, error: "purchase_not_found" };
        }

        if (purchase.identityGroupId) {
            log.debug(
                {
                    purchaseId: purchase.id,
                    existingGroupId: purchase.identityGroupId,
                    newGroupId: params.identityGroupId,
                },
                "Purchase already linked to identity group"
            );
            return {
                success: true,
                purchaseId: purchase.id,
                identityGroupId: purchase.identityGroupId,
                rewardsCreated: 0,
            };
        }

        const webhook = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.id, purchase.webhookId),
        });

        if (!webhook) {
            log.error(
                { purchaseId: purchase.id, webhookId: purchase.webhookId },
                "Webhook not found for purchase"
            );
            return { success: false, error: "webhook_not_found" };
        }

        await db
            .update(purchasesTable)
            .set({
                identityGroupId: params.identityGroupId,
                updatedAt: new Date(),
            })
            .where(eq(purchasesTable.id, purchase.id));

        const merchantId = params.merchantId ?? webhook.productId;

        await this.identityService.linkMerchantCustomer({
            identityGroupId: params.identityGroupId,
            merchantId,
            customerId: purchase.externalCustomerId,
        });

        log.info(
            {
                purchaseId: purchase.id,
                identityGroupId: params.identityGroupId,
                customerId: params.customerId,
            },
            "Linked purchase to identity group"
        );

        const rewardResult = await this.processRewardsForPurchase(
            purchase,
            webhook,
            params.identityGroupId
        );

        return {
            success: true,
            purchaseId: purchase.id,
            identityGroupId: params.identityGroupId,
            rewardsCreated: rewardResult.rewardsCreated,
        };
    }

    private async processRewardsForPurchase(
        purchase: typeof purchasesTable.$inferSelect,
        webhook: typeof merchantWebhooksTable.$inferSelect,
        identityGroupId: string
    ): Promise<{ rewardsCreated: number }> {
        const purchaseItems = await db.query.purchaseItemsTable.findMany({
            where: eq(purchaseItemsTable.purchaseId, purchase.id),
        });

        try {
            const result = await this.rewardService.processPurchase({
                merchantId: webhook.productId,
                identityGroupId,
                orderId: purchase.externalId,
                externalCustomerId: purchase.externalCustomerId,
                amount: Number.parseFloat(purchase.totalPrice),
                currency: purchase.currencyCode,
                items: purchaseItems.map((item) => ({
                    productId: item.externalId,
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: Number.parseFloat(item.price),
                    totalPrice: Number.parseFloat(item.price) * item.quantity,
                })),
                purchaseId: purchase.id,
            });

            log.info(
                {
                    purchaseId: purchase.id,
                    rewardsCreated: result.rewards.length,
                    budgetExceeded: result.budgetExceeded,
                },
                "Processed rewards for linked purchase"
            );

            return { rewardsCreated: result.rewards.length };
        } catch (error) {
            log.error(
                {
                    purchaseId: purchase.id,
                    error:
                        error instanceof Error ? error.message : String(error),
                },
                "Failed to process rewards for purchase"
            );
            return { rewardsCreated: 0 };
        }
    }
}
