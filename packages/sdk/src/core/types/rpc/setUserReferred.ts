import type { Hex } from "viem";

/**
 * Parameters of the referred request
 */
export type SetUserReferredParams = Readonly<{
    contentId: Hex;
}>;

/**
 * Return type of the referred request
 */
export type SetUserReferredReturnType =
    | UserConnected
    | UserNotConnected
    | UserIsSameWallet;

type UserConnected = {
    key: "connected";
};

type UserNotConnected = {
    key: "not-connected";
};

type UserIsSameWallet = {
    key: "same-wallet";
};
