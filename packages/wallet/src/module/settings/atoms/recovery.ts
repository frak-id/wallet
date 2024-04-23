import type { RecoveryFileContent } from "@/types/Recovery";
import { atom } from "jotai";
import type { Hex } from "viem";

/**
 * Atom to keep track of the current recovery step
 */
export const recoveryStepAtom = atom<number>(1);

/**
 * Atom to store the recovery password
 */
export const recoveryPasswordAtom = atom<string | undefined>(undefined);

/**
 * Atom to store the recovery options
 */
export const recoveryOptionsAtom = atom<
    | {
          setupTxData: Hex;
          file: RecoveryFileContent;
      }
    | undefined
>(undefined);
