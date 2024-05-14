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
    | UserIsSameWallet
    | UserReferredSuccessful
    | UserReferredHistory;

type UserIsSameWallet = {
    key: "same-wallet";
};

type UserReferredSuccessful = {
    key: "referred-successful";
};

type UserReferredHistory = {
    key: "referred-history";
};
