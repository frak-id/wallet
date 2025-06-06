import type { Address, Hex } from "viem";

/**
 * Global open panel properties
 */
export type AnalyticsGlobalProperties = {
    // Global
    wallet?: Address;
    isIframe: boolean;
    isPwa: boolean;
    // Iframe specifics
    productId: Hex;
    sourceUrl: string;
    walletReferrer?: Address;
};

/**
 * Different types of authentication events
 */
export type AnalyticsAuthenticationType =
    | "register"
    | "login"
    | "sso"
    | "pairing"
    | "demo";
