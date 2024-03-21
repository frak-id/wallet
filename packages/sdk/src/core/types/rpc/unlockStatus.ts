import type { Hex } from "viem";

/**
 * The different types of response for the current unlock status
 */
export type ArticleUnlockStatusReturnType = Readonly<
    | UnlockStatusLocked
    | UnlockStatusProcessing
    | UnlockStatusValid
    | UnlockStatusError
>;

/**
 * When the content unlocked was expired or not unlocked
 */
type UnlockStatusLocked =
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
 * When the content unlock is in progress
 */
type UnlockStatusProcessing = { status: "in-progress" } & (
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
      }
);

/**
 * When the content is unlocked
 */
type UnlockStatusValid = {
    key: "valid";
    status: "unlocked";
    allowedUntil: number;
};

/**
 * When the unlock content is in error
 */
type UnlockStatusError = {
    key: "error";
    status: "locked";
    reason: string;
};
