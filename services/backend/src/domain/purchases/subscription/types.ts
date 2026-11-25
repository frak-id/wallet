import type { SubscriptionProvider } from "../schemas";

type SubscriptionResolutionState = "pending" | "resolved" | "unresolved";

type SubscriptionOrderKind =
    | "none"
    | "checkout"
    | "renewal"
    | "prepaid_shipment";

/** Resolution state and result of one order, stored on `purchases.subscription`. */
export type PurchaseSubscription = {
    state: SubscriptionResolutionState;
    attempts: number;
    nextAttemptAt: string | null;
    kind?: SubscriptionOrderKind;
    providerSubscriptionIds?: string[];
    cyclesCovered?: number;
    merchandiseAmount?: number;
};

export type ResolvedSubscriptionOrder = {
    kind: SubscriptionOrderKind;
    providerSubscriptionIds: string[];
    cyclesCovered: number;
    /** Product subtotal after discounts, in the order currency. */
    merchandiseAmount: number;
};

export type TokenCheck = "valid" | "unauthorized" | "unavailable";

/** One implementation per provider; `"retry"` means the provider does not know the order yet. */
export type SubscriptionResolver = {
    readonly provider: SubscriptionProvider;
    verifyToken(token: string): Promise<TokenCheck>;
    resolve(
        order: { externalId: string },
        token: string
    ): Promise<ResolvedSubscriptionOrder | "retry">;
};

export type SubscriptionConnectionError = {
    at: string;
};

export type SubscriptionStatus = {
    provider: SubscriptionProvider | null;
    lastError: SubscriptionConnectionError | null;
};

/** Raised by a resolver when the provider rejects the stored credentials. */
export class SubscriptionAuthError extends Error {
    constructor() {
        super("Subscription provider rejected the stored credentials");
        this.name = "SubscriptionAuthError";
    }
}

/** Raised by a resolver when the provider cannot be reached or answers with a server error. */
export class SubscriptionUnavailableError extends Error {
    constructor() {
        super("Subscription provider is unavailable");
        this.name = "SubscriptionUnavailableError";
    }
}

/** Raised by a resolver when the provider throttles the merchant's token. */
export class SubscriptionRateLimitError extends Error {
    constructor(readonly retryAfterMs: number) {
        super("Subscription provider throttled the merchant's token");
        this.name = "SubscriptionRateLimitError";
    }
}
