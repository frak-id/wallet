import { log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { PendingPurchaseValidation } from "../domain/identity";
import type { IdentityRepository } from "../domain/identity/repositories/IdentityRepository";
import type { IdentityResolutionService } from "../domain/identity/services/IdentityResolutionService";
import type {
    MerchantWebhook,
    Purchase,
    PurchaseRepository,
} from "../domain/purchases";
import type { RewardOrchestrator } from "./RewardOrchestrator";

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

export class PurchaseLinkingOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly identityService: IdentityResolutionService,
        private readonly identityRepository: IdentityRepository,
        private readonly rewardOrchestrator: RewardOrchestrator
    ) {}

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

        const purchase = await this.purchaseRepository.findByOrderAndToken(
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

        const purchase = await this.purchaseRepository.findByOrderAndToken(
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

    async processRewardsForLinkedPurchase(purchaseId: string): Promise<{
        rewardsCreated: number;
    }> {
        const result =
            await this.purchaseRepository.findWithWebhook(purchaseId);

        if (!result) {
            log.error(
                { purchaseId },
                "Cannot process rewards: purchase or webhook not found"
            );
            return { rewardsCreated: 0 };
        }

        const { purchase, webhook } = result;

        if (!purchase.identityGroupId) {
            log.error(
                { purchaseId },
                "Cannot process rewards: no identityGroupId"
            );
            return { rewardsCreated: 0 };
        }

        return this.processRewardsInternal(
            purchase,
            webhook,
            purchase.identityGroupId
        );
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
        purchase: Purchase;
        identityGroupId: string;
        merchantId?: string;
        customerId: string;
    }): Promise<PurchaseLinkResult> {
        const { purchase, identityGroupId, customerId } = params;

        if (purchase.identityGroupId) {
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

        const webhook = await this.purchaseRepository.getWebhookById(
            purchase.webhookId
        );

        if (!webhook) {
            log.error(
                { purchaseId: purchase.id, webhookId: purchase.webhookId },
                "Webhook not found for purchase"
            );
            return { success: false, error: "webhook_not_found" };
        }

        await this.purchaseRepository.updateIdentityGroup(
            purchase.id,
            identityGroupId
        );

        const merchantId = params.merchantId ?? webhook.merchantId;

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
        purchase: Purchase
    ): Promise<string> {
        const webhook = await this.purchaseRepository.getWebhookById(
            purchase.webhookId
        );
        return webhook?.merchantId ?? "";
    }

    private async processRewardsInternal(
        purchase: Purchase,
        webhook: MerchantWebhook,
        identityGroupId: string
    ): Promise<{ rewardsCreated: number }> {
        const purchaseItems = await this.purchaseRepository.findItems(
            purchase.id
        );

        try {
            const result = await this.rewardOrchestrator.processPurchaseRewards(
                {
                    merchantId: webhook.merchantId,
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
                        totalPrice:
                            Number.parseFloat(item.price) * item.quantity,
                    })),
                    purchaseId: purchase.id,
                }
            );

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
