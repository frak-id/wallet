import type { Address } from "viem";

export type IdentityNode =
    | { type: "wallet"; value: Address }
    | { type: "anonymous_fingerprint"; value: string; merchantId: string };

export type ResolveResult = {
    groupId: string;
    isNew: boolean;
};

export type AssociateResult = {
    finalGroupId: string;
    merged: boolean;
};

export type GroupWeight = {
    groupId: string;
    hasWallet: boolean;
    wallet: Address | null;
    assetsCount: number;
    referralsCount: number;
    interactionsCount: number;
    touchpointsCount: number;
};

export class WalletConflictError extends Error {
    readonly code = "WALLET_CONFLICT" as const;
    constructor(
        readonly sourceWallet: Address,
        readonly targetWallet: Address
    ) {
        super("Cannot merge identities linked to different wallets");
    }
}
