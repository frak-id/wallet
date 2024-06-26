import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { atom } from "jotai";
import type { Hex, LocalAccount } from "viem";

/**
 * Atom to keep track of the current recovery step
 */
export const recoveryStepAtom = atom<number>(1);

/**
 * Atom to keep track of the done recovery steps
 */
export const recoveryDoneStepAtom = atom<number>(0);

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

/**
 * Atom to store the recovery file content
 */
export const recoveryFileContentAtom = atom<RecoveryFileContent | null>(null);

/**
 * Atom to store the guardian account
 */
export const recoveryGuardianAccountAtom = atom<LocalAccount<string> | null>(
    null
);

/**
 * Atom to store the new wallet
 */
export const recoveryNewWalletAtom = atom<WebAuthNWallet | null>(null);

/**
 * Atom to trigger the execute on chain
 */
export const recoveryTriggerExecuteOnChainAtom = atom<number>(0);

/**
 * Atom to keep track of the execute on chain in progress
 */
export const recoveryExecuteOnChainInProgressAtom = atom<boolean[]>([]);

/**
 * Atom to reset the recovery
 */
export const recoveryResetAtom = atom(null, (_get, set) => {
    set(recoveryStepAtom, 1);
    set(recoveryDoneStepAtom, 0);
    set(recoveryPasswordAtom, undefined);
    set(recoveryOptionsAtom, undefined);
    set(recoveryFileContentAtom, null);
    set(recoveryGuardianAccountAtom, null);
    set(recoveryNewWalletAtom, null);
    set(recoveryTriggerExecuteOnChainAtom, 0);
    set(recoveryExecuteOnChainInProgressAtom, []);
});
