import { log } from "@backend-infrastructure";
import { isUuid } from "@backend-utils";
import { isRunningInProd } from "@frak-labs/app-essentials";
import { LRUCache } from "lru-cache";
import type {
    MerchantRepository,
    MerchantSelect,
} from "../domain/merchant/repositories/MerchantRepository";
import {
    buildPaymentMessage,
    type PaymentNotification,
    type SlackClient,
} from "../infrastructure/integrations/slack";
import {
    type StripeCheckoutSession,
    stripeAmountToMajor,
    stripePaymentUrl,
} from "../infrastructure/integrations/stripe";

/** A Shopify one-time app purchase (merchant bank top-up) the merchant just approved. */
export type ShopifyPaidPurchase = {
    purchaseId: number;
    /** `*.myshopify.com` domain of the shop. */
    shop: string;
    /** Shop domain stored on the purchase row (primary domain when set). */
    domain: string;
    amount: string;
    currency: string;
    bank: string;
    paidAt: string;
    test: boolean;
    shopName?: string | null;
    email?: string | null;
};

const DEFAULT_CHANNEL = "payments";

/**
 * Posts merchant top-ups (Stripe Payment Link, Shopify app purchase) to Slack
 * so ops can fund the bank. Dedupe is per pod and in memory: a redelivery that
 * lands on another pod, or after a restart, posts a second time.
 */
export class PaymentNotificationOrchestrator {
    private readonly notified = new LRUCache<string, true>({
        max: 5_000,
        ttl: 7 * 24 * 60 * 60 * 1000,
    });

    constructor(
        private readonly merchants: MerchantRepository,
        private readonly slack: SlackClient
    ) {}

    async notifyStripeCheckout(
        session: StripeCheckoutSession,
        event: { created: number; livemode: boolean }
    ): Promise<void> {
        const currency = session.currency ?? "eur";
        const reference = session.payment_intent ?? session.id;
        const clientReference = session.client_reference_id;
        const merchant =
            clientReference && isUuid(clientReference)
                ? await this.findMerchant(() =>
                      this.merchants.findById(clientReference)
                  )
                : null;

        await this.post(`stripe:${session.id}`, {
            provider: "stripe",
            amount: stripeAmountToMajor(session.amount_total ?? 0, currency),
            currency,
            paidAt: new Date(event.created * 1000),
            reference,
            referenceUrl: session.payment_intent
                ? stripePaymentUrl(session.payment_intent, event.livemode)
                : undefined,
            test: !event.livemode,
            email: session.customer_details?.email,
            payerName: session.customer_details?.name,
            bankAddress: merchant?.bankAddress,
            merchant,
            unmatchedReference: merchant ? null : clientReference,
        });
    }

    async notifyShopifyPurchase(purchase: ShopifyPaidPurchase): Promise<void> {
        const merchant = await this.findMerchant(() =>
            this.findMerchantByShop(purchase)
        );

        await this.post(`shopify:${purchase.purchaseId}`, {
            provider: "shopify",
            amount: Number(purchase.amount),
            currency: purchase.currency,
            paidAt: new Date(purchase.paidAt),
            reference: `AppPurchaseOneTime ${purchase.purchaseId}`,
            test: purchase.test,
            email: purchase.email,
            shop: purchase.shopName
                ? `${purchase.shopName} (${purchase.shop})`
                : purchase.shop,
            bankAddress: purchase.bank,
            merchant,
        });
    }

    /** Custom domains are registered under the myshopify identity, so try both. */
    private async findMerchantByShop(
        purchase: ShopifyPaidPurchase
    ): Promise<MerchantSelect | null> {
        const primary = purchase.domain
            .replace(/^https?:\/\//, "")
            .replace(/^www\./, "");
        for (const domain of new Set([primary, purchase.shop])) {
            const merchant =
                (await this.merchants.findByDomain(domain)) ??
                (await this.merchants.findByAllowedDomain(domain));
            if (merchant) return merchant;
        }
        return null;
    }

    /** A failed lookup degrades to "merchant not found" rather than losing the notification. */
    private async findMerchant(
        lookup: () => Promise<MerchantSelect | null>
    ): Promise<MerchantSelect | null> {
        try {
            return await lookup();
        } catch (err) {
            log.error({ err }, "payment notification merchant lookup failed");
            return null;
        }
    }

    private async post(
        key: string,
        notification: PaymentNotification
    ): Promise<void> {
        if (this.notified.has(key)) {
            log.info({ key }, "payment already notified, skipping");
            return;
        }
        this.notified.set(key, true);

        const delivered = await this.slack.postMessage(
            buildPaymentMessage(notification, {
                channel: process.env.SLACK_PAYMENTS_CHANNEL || DEFAULT_CHANNEL,
                stage: isRunningInProd
                    ? undefined
                    : (process.env.STAGE ?? "local"),
                businessUrl: process.env.BUSINESS_URL,
            })
        );
        // No payer email here: logs are exported, and the reference finds the rest.
        log.info(
            {
                key,
                delivered,
                merchantId: notification.merchant?.id,
                amount: notification.amount,
                currency: notification.currency,
            },
            "payment notification"
        );
    }
}
