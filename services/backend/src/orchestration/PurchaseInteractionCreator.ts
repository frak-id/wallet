import { eventEmitter, log } from "@backend-infrastructure";
import type { InteractionLogRepository } from "../domain/rewards/repositories/InteractionLogRepository";
import type { PurchasePayload } from "../domain/rewards/types";
import { purchaseExternalEventId } from "../domain/rewards/utils";

type PurchaseInteractionParams = {
    purchaseId: string;
    externalId: string;
    externalCustomerId: string;
    totalPrice: string;
    currencyCode: string;
    items: {
        externalId: string;
        name: string;
        quantity: number;
        price: string;
    }[];
    identityGroupId: string;
    merchantId: string;
    /**
     * When `true`, the interaction is born already cancelled (e.g. the source
     * purchase arrived as `refunded`/`cancelled`, or a late SDK claim landed
     * on a purchase that was refunded in the meantime). The reward calculator
     * skips cancelled interactions, so no rewards will ever be minted from
     * them — we still create the row for audit/idempotency.
     */
    cancelled?: boolean;
};

/**
 * Shared logic for creating a purchase interaction log entry.
 *
 * Used by both PurchaseWebhookOrchestrator (claim-first path)
 * and PurchaseLinkingOrchestrator (late-claim path) to ensure
 * consistent interaction creation regardless of arrival order.
 */
export class PurchaseInteractionCreator {
    constructor(
        private readonly interactionLogRepository: InteractionLogRepository
    ) {}

    /**
     * Build a purchase payload and create an idempotent interaction log.
     * Emits `newInteraction` only when a fresh, non-cancelled interaction is
     * created (cancelled interactions never produce rewards, so waking the
     * reward cron is wasted work).
     * @returns The interaction log ID, or null if it already existed (duplicate).
     */
    async create(params: PurchaseInteractionParams): Promise<string | null> {
        const payload: PurchasePayload = {
            orderId: params.externalId,
            externalCustomerId: params.externalCustomerId,
            amount: Number(params.totalPrice),
            currency: params.currencyCode,
            items: params.items.map((item) => ({
                productId: item.externalId,
                name: item.name,
                quantity: item.quantity,
                unitPrice: Number(item.price),
                totalPrice: Number(item.price) * item.quantity,
            })),
            purchaseId: params.purchaseId,
        };

        const externalEventId = purchaseExternalEventId(params.externalId);
        const interactionLog =
            await this.interactionLogRepository.createIdempotent({
                type: "purchase",
                identityGroupId: params.identityGroupId,
                merchantId: params.merchantId,
                externalEventId,
                payload,
                cancelledAt: params.cancelled ? new Date() : null,
            });

        if (!interactionLog) {
            log.debug(
                { purchaseId: params.purchaseId, externalEventId },
                "Duplicate purchase interaction, skipping"
            );
            return null;
        }

        if (!params.cancelled) {
            eventEmitter.emit("newInteraction", { type: "purchase" });
        }

        log.info(
            {
                purchaseId: params.purchaseId,
                identityGroupId: params.identityGroupId,
                interactionLogId: interactionLog.id,
                cancelled: params.cancelled === true,
            },
            params.cancelled
                ? "Purchase interaction created (cancelled — source purchase refunded/cancelled)"
                : "Purchase interaction created"
        );

        return interactionLog.id;
    }
}
