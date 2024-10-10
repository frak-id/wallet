import type { Address } from "viem";

export type WalletStatusReturnType = Readonly<
    WalletConnected | WalletNotConnected
>;

export type WalletConnected = {
    key: "connected";
    wallet: Address;
    interactionSession?: {
        startTimestamp: number;
        endTimestamp: number;
    };
};

export type WalletNotConnected = {
    key: "not-connected";
    wallet?: never;
    interactionSession?: never;
};
