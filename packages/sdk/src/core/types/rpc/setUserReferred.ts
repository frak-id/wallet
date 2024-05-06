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
    | UserIsSameWallet
    | UserReferredSuccessful
    | UserReferredHistory;

type UserConnected = {
    key: "connected";
};

type UserNotConnected = {
    key: "not-connected";
};

type UserIsSameWallet = {
    key: "same-wallet";
};

type UserReferredSuccessful = {
    key: "referred-successful";
};

type UserReferredHistory = {
    key: "referred-history";
};
