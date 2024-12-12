import type { Address } from "viem";

/**
 * RPC Response for the method `frak_listenToWalletStatus`
 * @group RPC Schema
 */
export type WalletStatusReturnType = Readonly<
    WalletConnected | WalletNotConnected
>;

/**
 * @ignore
 * @inline
 */
export type WalletConnected = {
    key: "connected";
    // The user wallet address
    wallet: Address;
    // The interaction token, used to push interactions to the delegator if needed
    interactionToken?: string;
    // The current onchain interaction session of the user
    interactionSession?: {
        startTimestamp: number;
        endTimestamp: number;
    };
};

/**
 * @ignore
 * @inline
 */
export type WalletNotConnected = {
    key: "not-connected";
    wallet?: never;
    interactionToken?: never;
    interactionSession?: never;
};
