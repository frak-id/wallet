import type { Hex } from "viem";

/**
 * The request sent tà get the unlock status for the given article
 */
export type GetUnlockStatusParam = Readonly<{
    contentId: Hex;
    articleId: Hex;
}>;

/**
 * The different types of response for the current unlock status
 */
export type GetUnlockStatusResponse = Readonly<
    | UnlockStatusLockedResponse
    | UnlockStatusProcessingResponse
    | UnlockStatusValidResponse
    | UnlockStatusErrorResponse
>;

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusLockedResponse =
    | {
          key: "expired";
          status: "locked";
          expiredAt: number;
      }
    | {
          key: "not-unlocked";
          status: "locked";
      };

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusProcessingResponse =
    | {
          key: "preparing" | "waiting-user-validation";
      }
    | {
          key: "waiting-transaction-bundling";
          userOpHash: Hex;
      }
    | {
          key: "waiting-transaction-confirmation";
          userOpHash: Hex;
          txHash: Hex;
      };

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusValidResponse = {
    key: "valid";
    status: "unlocked";
    allowedUntil: number;
};

/**
 * When the content unlocked was expired a few time ago
 */
type UnlockStatusErrorResponse = {
    key: "error";
    status: "locked";
    reason: string;
};
