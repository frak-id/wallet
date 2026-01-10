import { eventEmitter, log } from "@backend-infrastructure";
import type { Address } from "viem";
import type { PendingPurchaseValidation } from "../domain/identity";
import type { IdentityRepository } from "../domain/identity/repositories/IdentityRepository";
import type { Purchase, PurchaseRepository } from "../domain/purchases";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchasePayload } from "../domain/rewards/types";
import type { IdentityNode, IdentityOrchestrator } from "./identity";

type PurchaseLinkParams = {
    customerId: string;
    orderId: string;
    token: string;
};

type PurchaseLinkResult = {
    success: boolean;
    purchaseId?: string;
    identityGroupId?: string;
    interactionLogId?: string;
    pendingWebhook?: boolean;
    error?: string;
};

export class PurchaseLinkingOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly identityRepository: IdentityRepository,
        private readonly interactionLogRepository: InteractionLogRepository,
        private readonly identityOrchestrator: IdentityOrchestrator
    ) {}

    async linkPurchaseFromSdk(
        params: PurchaseLinkParams & {
            clientId: string;
            merchantId: string;
        }
    ): Promise<PurchaseLinkResult> {
        const { groupId: identityGroupId } =
            await this.identityOrchestrator.resolve({
                type: "anonymous_fingerprint",
                value: params.clientId,
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
        const nodes: IdentityNode[] = [
            { type: "wallet", value: params.wallet },
        ];

        if (params.clientId && params.merchantId) {
            nodes.push({
                type: "anonymous_fingerprint",
                value: params.clientId,
                merchantId: params.merchantId,
            });
        }

        const { finalGroupId: identityGroupId } =
            await this.identityOrchestrator.resolveAndAssociate(nodes);

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
                const merchantId =
                    params.merchantId ??
                    (await this.getMerchantIdFromPurchase(purchase));

                await this.identityOrchestrator.resolveAndAssociate([
                    {
                        type: "merchant_customer",
                        value: customerId,
                        merchantId,
                    },
                ]);

                await this.identityOrchestrator.associate(
                    purchase.identityGroupId,
                    identityGroupId
                );

                log.info(
                    {
                        purchaseId: purchase.id,
                        existingGroupId: purchase.identityGroupId,
                        newGroupId: identityGroupId,
                    },
                    "Purchase already linked - merged identity groups (Scenario C edge case)"
                );

                eventEmitter.emit("newInteraction", { type: "identity_merge" });
            }

            return {
                success: true,
                purchaseId: purchase.id,
                identityGroupId: purchase.identityGroupId,
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

        const customerResult = await this.identityOrchestrator.resolve({
            type: "merchant_customer",
            value: customerId,
            merchantId,
        });

        if (customerResult.groupId !== identityGroupId) {
            await this.identityOrchestrator.associate(
                identityGroupId,
                customerResult.groupId
            );
        }

        log.info(
            {
                purchaseId: purchase.id,
                identityGroupId,
                customerId,
            },
            "Linked purchase to identity group"
        );

        const interactionLogId = await this.createInteractionLog(
            purchase,
            identityGroupId,
            merchantId
        );

        return {
            success: true,
            purchaseId: purchase.id,
            identityGroupId,
            interactionLogId,
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

    private async createInteractionLog(
        purchase: Purchase,
        identityGroupId: string,
        merchantId: string
    ): Promise<string> {
        const purchaseItems = await this.purchaseRepository.findItems(
            purchase.id
        );

        const payload: PurchasePayload = {
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
        };

        const interactionLog = await this.interactionLogRepository.create({
            type: "purchase",
            identityGroupId,
            merchantId,
            payload,
        });

        eventEmitter.emit("newInteraction", { type: "purchase" });

        log.info(
            {
                purchaseId: purchase.id,
                identityGroupId,
                interactionLogId: interactionLog.id,
            },
            "Created interaction log for linked purchase (reward calculation deferred to batch job)"
        );

        return interactionLog.id;
    }
}
