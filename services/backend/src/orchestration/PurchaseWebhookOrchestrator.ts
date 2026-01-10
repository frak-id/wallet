import { eventEmitter, log } from "@backend-infrastructure";
import type {
    PurchaseInsert,
    PurchaseItemInsert,
    PurchaseRepository,
} from "../domain/purchases";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchasePayload } from "../domain/rewards/types";
import type { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";

type UpsertPurchaseParams = {
    purchase: PurchaseInsert;
    purchaseItems: PurchaseItemInsert[];
    merchantId: string;
};

type UpsertPurchaseResult = {
    purchaseId: string;
    identityGroupId?: string;
    interactionLogId?: string;
};

export class PurchaseWebhookOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly linkingOrchestrator: PurchaseLinkingOrchestrator,
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    async upsertPurchase({
        purchase,
        purchaseItems,
        merchantId,
    }: UpsertPurchaseParams): Promise<UpsertPurchaseResult> {
        const pendingIdentity =
            await this.linkingOrchestrator.checkPendingIdentityForPurchase({
                customerId: purchase.externalCustomerId,
                orderId: purchase.externalId,
                token: purchase.purchaseToken ?? "",
                merchantId,
            });

        const identityGroupId = pendingIdentity?.identityGroupId;

        const purchaseId = await this.purchaseRepository.upsertWithItems({
            purchase,
            items: purchaseItems,
            identityGroupId,
        });

        log.debug(
            {
                purchaseId,
                identityGroupId,
                hasPendingIdentity: !!pendingIdentity,
            },
            "Purchase upserted"
        );

        let interactionLogId: string | undefined;

        if (identityGroupId) {
            const payload: PurchasePayload = {
                orderId: purchase.externalId,
                externalCustomerId: purchase.externalCustomerId,
                amount: Number(purchase.totalPrice),
                currency: purchase.currencyCode,
                items: purchaseItems.map((item) => ({
                    productId: item.externalId,
                    name: item.name,
                    quantity: item.quantity,
                    unitPrice: Number(item.price),
                    totalPrice: Number(item.price) * item.quantity,
                })),
                purchaseId,
            };

            const interactionLog = await this.interactionLogRepository.create({
                type: "purchase",
                identityGroupId,
                merchantId,
                payload,
            });

            interactionLogId = interactionLog.id;

            eventEmitter.emit("newInteraction", { type: "purchase" });

            log.info(
                {
                    purchaseId,
                    identityGroupId,
                    interactionLogId,
                },
                "Created interaction log for purchase (reward calculation deferred to batch job)"
            );
        }

        return {
            purchaseId,
            identityGroupId,
            interactionLogId,
        };
    }
}
