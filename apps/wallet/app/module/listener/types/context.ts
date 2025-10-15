import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import type { Address, Hex } from "viem";
import type { SsoRpcSchema } from "@/types/sso-rpc";

/**
 * Augmented context for wallet RPC handlers
 * Includes both base RPC context fields (origin, source) and wallet-specific fields
 *
 * This context is populated by middleware and passed to all handlers,
 * eliminating the need for handlers to manually read from Jotai store
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
     * The product ID (derived from domain)
     * Already validated to match the message origin
     */
    productId: Hex;

    /**
     * The full source URL
     */
    sourceUrl: string;

    /**
     * Whether this context was auto-computed or from handshake
     */
    isAutoContext: boolean;

    /**
     * Optional wallet referrer address
     */
    walletReferrer?: Address;
};

/**
 * Combined schema type for handling IFrame RPC and SSO RPC
 */
export type CombinedRpcSchema = IFrameRpcSchema | SsoRpcSchema;
