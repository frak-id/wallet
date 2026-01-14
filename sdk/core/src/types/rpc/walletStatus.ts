import type { Address } from "viem";

/**
 * RPC Response for the method `frak_listenToWalletStatus`
 * @group RPC Schema
 */
export type WalletStatusReturnType = WalletConnected | WalletNotConnected;

/**
 * @ignore
 * @inline
 */
export type WalletConnected = {
    key: "connected";
    // The user wallet address
    wallet: Address;
    // The interaction token, used to push interactions to the backend
    interactionToken?: string;
};

/**
 * @ignore
 * @inline
 */
export type WalletNotConnected = {
    key: "not-connected";
    wallet?: never;
    interactionToken?: never;
};
