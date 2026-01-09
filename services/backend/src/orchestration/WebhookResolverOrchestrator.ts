import { log } from "@backend-infrastructure";
import { type Hex, isHex } from "viem";
import type { MerchantRepository } from "../domain/merchant/repositories/MerchantRepository";
import type {
    MerchantWebhook,
    PurchaseRepository,
} from "../domain/purchases/repositories/PurchaseRepository";

export type ResolvedWebhook = {
    webhook: MerchantWebhook;
    merchantId: string;
};

export class WebhookResolverOrchestrator {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly merchantRepository: MerchantRepository
    ) {}

    async resolveWebhook(identifier: string): Promise<ResolvedWebhook | null> {
        if (isHex(identifier)) {
            return this.resolveByProductId(identifier);
        }
        return this.resolveByMerchantId(identifier);
    }

    private async resolveByProductId(
        productId: Hex
    ): Promise<ResolvedWebhook | null> {
        const merchant =
            await this.merchantRepository.findByProductId(productId);
        if (!merchant) {
            log.warn({ productId }, "Merchant not found for legacy productId");
            return null;
        }

        const webhook = await this.purchaseRepository.getWebhookByMerchantId(
            merchant.id
        );
        if (!webhook) {
            log.warn(
                { productId, merchantId: merchant.id },
                "Webhook not found for merchant"
            );
            return null;
        }

        return { webhook, merchantId: merchant.id };
    }

    private async resolveByMerchantId(
        merchantId: string
    ): Promise<ResolvedWebhook | null> {
        const webhook =
            await this.purchaseRepository.getWebhookByMerchantId(merchantId);
        if (!webhook) {
            log.warn({ merchantId }, "Webhook not found for merchantId");
            return null;
        }

        return { webhook, merchantId };
    }
}
