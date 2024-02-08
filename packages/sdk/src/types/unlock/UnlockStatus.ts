import type { Address, Hex } from "viem";

/**
 * The flow we want ->
 *   1. On news paper, click unlock with FRK
 *      a. If no account linked yet, give a few options to link an account and then to link the account
 *      b. If account linked, display the price options
 *   2. Redirect to the FRK Wallet with the rights options (prices and stuff)
 *   3. If requested, generate a signature to allow the user to read the news paper
 *   4. Then, recap the operations (article, article preview, prices etc) and ask for payment
 *   5. Once done, either embed or redirect to the article depending on the user choice
 *
 *   Idea for encoding:
 *     - https://github.com/pieroxy/lz-string
 *     - Base64 + keccak hash?
 *     -
 *
 */

/**
 * The request sent tà get the unlock status for the given article
 */
export type GetUnlockStatusParams = Readonly<{
    contentId: Hex;
    articleId: Hex;
}>;

/**
 * The different types of response for the current unlock status
 */
export type GetUnlockStatusResponse = Readonly<
    | UnlockStatusNotConnectedResponse
    | UnlockStatusExpiredResponse
    | UnlockStatusProcessingResponse
    | UnlockStatusValidResponse
>;

/**
 * Response when a user isn't logged in (not registered or not logged in if previously registered)
 */
type UnlockStatusNotConnectedResponse = Readonly<{
    key: "not-registered" | "not-logged-in";
    status: "locked";
}>;

/**
 * Generic type for the unlock status response when a user is logged in
 */
type LoggedUnlockStatusResponse = {
    user: Address;
    // The raw frk balance
    frkBalance: Hex;
};

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusExpiredResponse = LoggedUnlockStatusResponse & {
    key: "expired";
    status: "locked";
    expiredAt: number;
};

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusProcessingResponse = LoggedUnlockStatusResponse & {
    status: "in-progress";
} & (
        | {
              key: "waiting-user-validation";
              status: "in-progress";
          }
        | {
              key: "waiting-transaction-bundling";
              status: "in-progress";
              userOpHash: Hex;
          }
        | {
              key: "waiting-transaction-confirmation";
              status: "in-progress";
              userOpHash: Hex;
              txHash: Hex;
          }
    );

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusValidResponse = LoggedUnlockStatusResponse & {
    key: "valid";
    status: "unlocked";
    userOpHash: Hex;
    txHash: Hex;
    allowedUntil: number;
};