import type {
    RecoveryFileContent,
    WebAuthNWallet,
} from "@frak-labs/wallet-shared";
import type { Hex, LocalAccount } from "viem";
import { create } from "zustand";

type RecoveryState = {
    /**
     * Current step in the recovery wizard (1-4 for setup, 1-5 for recovery)
     */
    step: number;

    /**
     * Password entered by user for recovery file encryption/decryption
     */
    password: string | undefined;

    /**
     * Recovery setup options (transaction data and file content)
     */
    options:
        | {
              setupTxData: Hex;
              file: RecoveryFileContent;
          }
        | undefined;

    /**
     * Content of the recovery file being processed
     */
    fileContent: RecoveryFileContent | null;

    /**
     * Guardian account used for recovery
     */
    guardianAccount: LocalAccount<string> | null;

    /**
     * New wallet created during recovery process
     */
    newWallet: WebAuthNWallet | null;
};

type RecoveryActions = {
    /**
     * Set the current step
     */
    setStep: (step: number) => void;

    /**
     * Set the recovery password
     */
    setPassword: (password: string | undefined) => void;

    /**
     * Set the recovery options
     */
    setOptions: (
        options:
            | {
                  setupTxData: Hex;
                  file: RecoveryFileContent;
              }
            | undefined
    ) => void;

    /**
     * Set the recovery file content
     */
    setFileContent: (fileContent: RecoveryFileContent | null) => void;

    /**
     * Set the guardian account
     */
    setGuardianAccount: (account: LocalAccount<string> | null) => void;

    /**
     * Set the new wallet
     */
    setNewWallet: (wallet: WebAuthNWallet | null) => void;

    /**
     * Reset all recovery state to initial values
     */
    reset: () => void;
};

const initialState: RecoveryState = {
    step: 1,
    password: undefined,
    options: undefined,
    fileContent: null,
    guardianAccount: null,
    newWallet: null,
};

export const recoveryStore = create<RecoveryState & RecoveryActions>()(
    (set) => ({
        ...initialState,

        setStep: (step) => set({ step }),

        setPassword: (password) => set({ password }),

        setOptions: (options) => set({ options }),

        setFileContent: (fileContent) => set({ fileContent }),

        setGuardianAccount: (guardianAccount) => set({ guardianAccount }),

        setNewWallet: (newWallet) => set({ newWallet }),

        reset: () => set(initialState),
    })
);

/**
 * Selectors for common recovery state access patterns
 */
export const selectRecoveryStep = (state: RecoveryState & RecoveryActions) =>
    state.step;
export const selectRecoveryPassword = (
    state: RecoveryState & RecoveryActions
) => state.password;
export const selectRecoveryOptions = (state: RecoveryState & RecoveryActions) =>
    state.options;
export const selectRecoveryFileContent = (
    state: RecoveryState & RecoveryActions
) => state.fileContent;
export const selectRecoveryGuardianAccount = (
    state: RecoveryState & RecoveryActions
) => state.guardianAccount;
export const selectRecoveryNewWallet = (
    state: RecoveryState & RecoveryActions
) => state.newWallet;
