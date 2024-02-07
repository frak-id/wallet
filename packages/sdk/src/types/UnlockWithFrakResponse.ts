import type { Address, Hex } from "viem";

/**
 * Response of a content unlock
 */
export type UnlockWithFrakResponse = Readonly<{
    articleId: Hex;
    contentId: Hex;
    // The wallet address of the user who unlocked it
    walletAddress: Address;
    // The status of the unlock
    outcome:
        | {
              kind: "unlocking";
              // The hash of the user operation for the unlocked
              operationHash?: Hex;
              // The price index picked by the user
              priceIndex?: number;
          }
        | {
              key: "disallowed";
          };
}>;
