import { atomWithStorage } from "jotai/utils";
import type { Hex } from "viem";

export type PaywallStatus =
    | {
          key: "idle" | "cancelled" | "pendingSignature";
      }
    | {
          key: "pendingTx";
          userOpHash: Hex;
      }
    | {
          key: "success";
          txHash: Hex;
          userOpHash: Hex;
      }
    | {
          key: "error";
          txHash?: Hex;
          userOpHash?: Hex;
          reason?: string;
      };

/**
 * Atom with the status in local storage
 */
export const paywallStatusAtom = atomWithStorage<PaywallStatus | null>(
    "paywallStatus",
    null
);
