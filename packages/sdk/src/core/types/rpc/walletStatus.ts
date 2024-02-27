import type { Address, Hex } from "viem";

export type WalletStatusReturnType = Readonly<
    WalletConnected | WalletNotConnected
>;

export type WalletConnected = {
    key: "connected";
    wallet: Address;
    // The frk balance in wei
    frkBalanceAsHex: Hex;
};

export type WalletNotConnected = {
    key: "not-connected";
};
