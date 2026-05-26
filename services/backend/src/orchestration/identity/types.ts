import type { Address } from "viem";

export type IdentityNode =
    | { type: "wallet"; value: Address }
    | { type: "anonymous_fingerprint"; value: string; merchantId: string }
    | { type: "email"; value: string };

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
    /**
     * Number of merchants whose `owner_wallet` is this group's wallet. Weighted
     * heavily in the anchor decision: losing business privileges to a higher
     * activity counter (assets/referrals/interactions) would silently strip
     * dashboard access on merge.
     */
    merchantOwnershipsCount: number;
    /** Number of `merchant_admins` rows that reference this group's wallet. */
    merchantAdminshipsCount: number;
};
