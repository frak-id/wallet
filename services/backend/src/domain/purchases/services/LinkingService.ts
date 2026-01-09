import { db, log } from "@backend-infrastructure";
import { and, eq } from "drizzle-orm";
import type { Address } from "viem";
import type { PendingPurchaseValidation } from "../../identity";
import { IdentityRepository } from "../../identity/repositories/IdentityRepository";
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
    pendingWebhook?: boolean;
    error?: string;
};

export class PurchaseLinkingService {
    private readonly identityService: IdentityResolutionService;
    private readonly identityRepository: IdentityRepository;
    private readonly rewardService: RewardProcessingService;

    constructor(
        identityService?: IdentityResolutionService,
        identityRepository?: IdentityRepository,
        rewardService?: RewardProcessingService
    ) {
        this.identityService =
            identityService ?? new IdentityResolutionService();
        this.identityRepository =
            identityRepository ?? new IdentityRepository();
        this.rewardService = rewardService ?? new RewardProcessingService();
    }

    /**
     * Called by SDK when user completes purchase (thank you page).
     * Two scenarios:
     * - Webhook arrived first: Purchase exists, link identity and process rewards
     * - SDK arrives first: Purchase doesn't exist, create pending merchant_customer node
     */
    async linkPurchaseFromSdk(
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

        const purchase = await this.findPurchaseByOrderAndToken(
            params.orderId,
            params.token
        );

        if (!purchase) {
            await this.createPendingMerchantCustomerNode({
                identityGroupId,
                merchantId: params.merchantId,
                customerId: params.customerId,
                orderId: params.orderId,
                token: params.token,
            });

            log.info(
                {
                    identityGroupId,
                    customerId: params.customerId,
                    orderId: params.orderId,
                },
                "Created pending merchant_customer node (webhook not yet received)"
            );

            return {
                success: true,
                identityGroupId,
                pendingWebhook: true,
            };
        }

        return this.linkPurchaseToIdentity({
            purchase,
            identityGroupId,
            merchantId: params.merchantId,
            customerId: params.customerId,
        });
    }

    /**
     * Called by SDK with wallet auth (legacy flow).
     */
    async linkPurchaseFromWallet(
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

        const purchase = await this.findPurchaseByOrderAndToken(
            params.orderId,
            params.token
        );

        if (!purchase) {
            if (params.merchantId) {
                await this.createPendingMerchantCustomerNode({
                    identityGroupId,
                    merchantId: params.merchantId,
                    customerId: params.customerId,
                    orderId: params.orderId,
                    token: params.token,
                });

                log.info(
                    {
                        identityGroupId,
                        wallet: params.wallet,
                        orderId: params.orderId,
                    },
                    "Created pending merchant_customer node from wallet (webhook not yet received)"
                );

                return {
                    success: true,
                    identityGroupId,
                    pendingWebhook: true,
                };
            }

            return { success: false, error: "purchase_not_found" };
        }

        return this.linkPurchaseToIdentity({
            purchase,
            identityGroupId,
            merchantId: params.merchantId,
            customerId: params.customerId,
        });
    }

    /**
     * Called by webhook handler to check for pending identity and link.
     * Returns identityGroupId if a pending node was found and validated.
     */
    async checkPendingIdentityForPurchase(params: {
        customerId: string;
        orderId: string;
        token: string;
        merchantId: string;
    }): Promise<{ identityGroupId: string } | null> {
        const pendingNode =
            await this.identityRepository.findNodeWithPendingValidation({
                type: "merchant_customer",
                value: params.customerId,
                merchantId: params.merchantId,
            });

        if (!pendingNode?.validationData) {
            return null;
        }

        const validation =
            pendingNode.validationData as PendingPurchaseValidation;
        if (
            validation.orderId !== params.orderId ||
            validation.purchaseToken !== params.token
        ) {
            log.warn(
                {
                    expected: validation,
                    received: { orderId: params.orderId, token: params.token },
                },
                "Pending node validation mismatch"
            );
            return null;
        }

        await this.identityRepository.clearValidationData(pendingNode.id);

        log.info(
            {
                nodeId: pendingNode.id,
                groupId: pendingNode.groupId,
                customerId: params.customerId,
            },
            "Validated pending merchant_customer node from webhook"
        );

        return { identityGroupId: pendingNode.groupId };
    }

    /**
     * Process rewards for a purchase that has been linked to an identity.
     * Called after webhook stores the purchase with identityGroupId.
     */
    async processRewardsForLinkedPurchase(purchaseId: string): Promise<{
        rewardsCreated: number;
    }> {
        const purchase = await db.query.purchasesTable.findFirst({
            where: eq(purchasesTable.id, purchaseId),
        });

        if (!purchase?.identityGroupId) {
            log.error(
                { purchaseId },
                "Cannot process rewards: no identityGroupId"
            );
            return { rewardsCreated: 0 };
        }

        const webhook = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.id, purchase.webhookId),
        });

        if (!webhook) {
            log.error(
                { purchaseId },
                "Cannot process rewards: webhook not found"
            );
            return { rewardsCreated: 0 };
        }

        return this.processRewardsInternal(
            purchase,
            webhook,
            purchase.identityGroupId
        );
    }

    private async findPurchaseByOrderAndToken(orderId: string, token: string) {
        return db.query.purchasesTable.findFirst({
            where: and(
                eq(purchasesTable.externalId, orderId),
                eq(purchasesTable.purchaseToken, token)
            ),
        });
    }

    private async createPendingMerchantCustomerNode(params: {
        identityGroupId: string;
        merchantId: string;
        customerId: string;
        orderId: string;
        token: string;
    }): Promise<void> {
        const validationData: PendingPurchaseValidation = {
            orderId: params.orderId,
            purchaseToken: params.token,
        };

        await this.identityRepository.addNode({
            groupId: params.identityGroupId,
            type: "merchant_customer",
            value: params.customerId,
            merchantId: params.merchantId,
            validationData,
        });
    }

    private async linkPurchaseToIdentity(params: {
        purchase: typeof purchasesTable.$inferSelect;
        identityGroupId: string;
        merchantId?: string;
        customerId: string;
    }): Promise<PurchaseLinkResult> {
        const { purchase, identityGroupId, customerId } = params;

        if (purchase.identityGroupId) {
            /*
             * EDGE CASE: Returning customer with new referral link (Scenario C)
             *
             * This happens when:
             * - Customer made a purchase before (merchant_customer exists → old group)
             * - Customer returns via NEW referral link (touchpoint on NEW anonId group)
             * - Webhook arrived first and used the old group's identity
             * - SDK now calls with the new anonId
             *
             * Current behavior (V1): We keep the old attribution.
             * The merge will still happen, combining the identities, but rewards
             * were already processed with old attribution.
             *
             * TODO (V2): Implement delayed processing cron that waits 30-60 seconds
             * before processing rewards, allowing SDK call to arrive and properly
             * merge identities first. See REFACTO_FOR_LATER.md for details.
             */
            if (purchase.identityGroupId !== identityGroupId) {
                await this.identityService.linkMerchantCustomer({
                    identityGroupId,
                    merchantId:
                        params.merchantId ??
                        (await this.getMerchantIdFromPurchase(purchase)),
                    customerId,
                });

                log.info(
                    {
                        purchaseId: purchase.id,
                        existingGroupId: purchase.identityGroupId,
                        newGroupId: identityGroupId,
                    },
                    "Purchase already linked - merged identity groups (Scenario C edge case)"
                );
            }

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
                identityGroupId,
                updatedAt: new Date(),
            })
            .where(eq(purchasesTable.id, purchase.id));

        const merchantId = params.merchantId ?? webhook.productId;

        await this.identityService.linkMerchantCustomer({
            identityGroupId,
            merchantId,
            customerId,
        });

        log.info(
            {
                purchaseId: purchase.id,
                identityGroupId,
                customerId,
            },
            "Linked purchase to identity group"
        );

        const rewardResult = await this.processRewardsInternal(
            purchase,
            webhook,
            identityGroupId
        );

        return {
            success: true,
            purchaseId: purchase.id,
            identityGroupId,
            rewardsCreated: rewardResult.rewardsCreated,
        };
    }

    private async getMerchantIdFromPurchase(
        purchase: typeof purchasesTable.$inferSelect
    ): Promise<string> {
        const webhook = await db.query.merchantWebhooksTable.findFirst({
            where: eq(merchantWebhooksTable.id, purchase.webhookId),
        });
        return webhook?.productId ?? "";
    }

    private async processRewardsInternal(
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
