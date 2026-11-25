import { log } from "@backend-infrastructure";
import type { MerchantWebhook } from "../db/schema";
import type { PurchaseRepository } from "../repositories/PurchaseRepository";
import type { SubscriptionProvider } from "../schemas";
import type {
    SubscriptionConnectionError,
    SubscriptionResolver,
    SubscriptionStatus,
} from "../subscription/types";
import type { SubscriptionCredentialsCipher } from "./SubscriptionCredentialsCipher";

type StoredCredentials = {
    v: 1;
    token: string;
    lastError: SubscriptionConnectionError | null;
};

type ConnectResult =
    | "connected"
    | "no_webhook"
    | "unauthorized"
    | "unavailable";

export type ConnectedProvider = {
    resolver: SubscriptionResolver;
    token: string;
};

function parseStored(raw: string | null): StoredCredentials | null {
    if (!raw) return null;
    try {
        const parsed = JSON.parse(raw) as Partial<StoredCredentials>;
        return parsed.v === 1 && typeof parsed.token === "string"
            ? {
                  v: 1,
                  token: parsed.token,
                  lastError: parsed.lastError ?? null,
              }
            : null;
    } catch {
        return null;
    }
}

/** Connects a merchant's subscription provider and hands its decrypted token to the resolver job. */
export class SubscriptionConnectionService {
    constructor(
        private readonly purchaseRepository: PurchaseRepository,
        private readonly cipher: SubscriptionCredentialsCipher,
        private readonly resolvers: Record<
            SubscriptionProvider,
            SubscriptionResolver
        >
    ) {}

    async connect(params: {
        merchantId: string;
        provider: SubscriptionProvider;
        token: string;
    }): Promise<ConnectResult> {
        const { merchantId, provider, token } = params;
        const webhook =
            await this.purchaseRepository.getWebhookByMerchantId(merchantId);
        if (!webhook) return "no_webhook";

        const check = await this.resolvers[provider].verifyToken(token);
        if (check !== "valid") return check;

        const credentials = JSON.stringify({
            v: 1,
            token: await this.cipher.encrypt(token, merchantId),
            lastError: null,
        } satisfies StoredCredentials);
        await this.purchaseRepository.setSubscriptionConnection(merchantId, {
            provider,
            credentials,
        });
        return "connected";
    }

    async disconnect(merchantId: string): Promise<boolean> {
        return this.purchaseRepository.setSubscriptionConnection(
            merchantId,
            null
        );
    }

    async getStatus(merchantId: string): Promise<SubscriptionStatus> {
        const webhook =
            await this.purchaseRepository.getWebhookByMerchantId(merchantId);
        if (!webhook?.subscriptionProvider) {
            return { provider: null, lastError: null };
        }
        return {
            provider: webhook.subscriptionProvider,
            lastError:
                parseStored(webhook.subscriptionCredentials)?.lastError ?? null,
        };
    }

    /** Null when the merchant has no connected provider or the stored token cannot be read. */
    async resolveProvider(
        webhook: MerchantWebhook
    ): Promise<ConnectedProvider | null> {
        const stored = parseStored(webhook.subscriptionCredentials);
        if (!(webhook.subscriptionProvider && stored)) return null;
        try {
            return {
                resolver: this.resolvers[webhook.subscriptionProvider],
                token: await this.cipher.decrypt(
                    stored.token,
                    webhook.merchantId
                ),
            };
        } catch (err) {
            log.error(
                { err, merchantId: webhook.merchantId },
                "Subscription credentials unreadable"
            );
            return null;
        }
    }

    /** Kept on the webhook row so the Shopify app card can show it. */
    async recordAuthError(webhook: MerchantWebhook): Promise<void> {
        const stored = parseStored(webhook.subscriptionCredentials);
        if (!stored || stored.lastError) return;
        const credentials = JSON.stringify({
            ...stored,
            lastError: { code: "unauthorized", at: new Date().toISOString() },
        } satisfies StoredCredentials);
        await this.purchaseRepository.setSubscriptionCredentials(
            webhook.merchantId,
            credentials
        );
    }
}
