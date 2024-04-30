import type { Address } from "viem";

export type WalletStatusReturnType = Readonly<
    WalletConnected | WalletNotConnected
>;

export type WalletConnected = {
    key: "connected";
    wallet: Address;
};

export type WalletNotConnected = {
    key: "not-connected";
};
