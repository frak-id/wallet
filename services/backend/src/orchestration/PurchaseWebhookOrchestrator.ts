import { log } from "@backend-infrastructure";
import type {
    PurchaseInsert,
    PurchaseItemInsert,
    PurchaseRepository,
} from "../domain/purchases";
import type { PurchaseLinkingOrchestrator } from "./PurchaseLinkingOrchestrator";

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

export class PurchaseWebhookOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly linkingOrchestrator: PurchaseLinkingOrchestrator
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

        let rewardsProcessed = false;

        if (identityGroupId) {
            const result =
                await this.linkingOrchestrator.processRewardsForLinkedPurchase(
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
