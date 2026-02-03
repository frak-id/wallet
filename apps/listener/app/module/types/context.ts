import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { SsoRpcSchema } from "@frak-labs/wallet-shared";

/**
 * Augmented context for wallet RPC handlers
 * Includes both base RPC context fields (origin, source) and wallet-specific fields
 *
 * This context is populated by middleware and passed to all handlers,
 * eliminating the need for handlers to manually read from Zustand store
 */
export type WalletRpcContext = {
    /**
     * Origin of the request (from base RPC context)
     */
    origin: string;

    /**
     * Message source for responding (from base RPC context)
     */
    source: MessageEventSource | null;

    /**
     * The merchant ID (UUID from backend)
     * Primary identifier for the merchant
     */
    merchantId: string;

    /**
     * The full source URL
     */
    sourceUrl: string;

    /**
     * Whether this context was auto-computed or from handshake
     */
    isAutoContext: boolean;

    /**
     * Anonymous client ID from the SDK for identity tracking
     */
    clientId?: string;
};

/**
 * Combined schema type for handling IFrame RPC and SSO RPC
 */
export type CombinedRpcSchema = IFrameRpcSchema | SsoRpcSchema;
