import type { ModalStepTypes } from "@frak-labs/core-sdk";

type ModalStepKey = ModalStepTypes["key"];

/**
 * Reason the listener modal was closed. Distinguishes organic completion
 * (`final_action`) from user-initiated aborts so funnel analysis can
 * separate "task finished" from "task abandoned".
 */
export type ModalDismissSource =
    | "backdrop"
    | "close_btn"
    | "escape"
    | "final_action";

type ModalBaseProps = {
    productId?: string;
};

/**
 * Listener modal event map. Events are emitted from the iframe listener app
 * that hosts partner-initiated modals (login, siwe, sendTransaction, final).
 *
 * Step-level funnel uses `modal_step_viewed` transitions — completion of
 * step N is inferred from the next `modal_step_viewed` (step N+1) or from
 * `modal_dismissed` with `last_step`. `modal_step_error` surfaces failures.
 */
export type ModalEventMap = {
    modal_opened: ModalBaseProps & {
        steps: ModalStepKey[];
        /** Entry point: a modal step key, or the final-action key (sharing/reward) when opening on `final`. */
        entry_step: string;
    };
    modal_dismissed: ModalBaseProps & {
        last_step?: ModalStepKey;
        completed: boolean;
        source: ModalDismissSource;
    };
    modal_step_viewed: ModalBaseProps & {
        step: string;
        index: number;
        total: number;
    };
    modal_step_error: ModalBaseProps & {
        step: string;
        reason: string;
        recoverable: boolean;
    };
};

/**
 * Wallet-side modal auto-tracking. Emitted by the wallet `modalStore`
 * subscription — every `openModal` / `closeModal` call produces a pair
 * without any per-modal instrumentation.
 *
 * `modal` is the discriminator id from the wallet `ModalState` union
 * (e.g. "transfer", "keypass", "recoveryCodeSuccess"). We accept a bare
 * string here to keep `wallet-shared` decoupled from the wallet app.
 *
 * `from_stack` distinguishes "user explicitly opened a new modal" from
 * "user popped back to an earlier modal in the stack" — filters out
 * inflated counts when the ModalOutlet re-renders a previous modal.
 */
export type WalletModalEventMap = {
    wallet_modal_opened: {
        modal: string;
        from_stack: boolean;
    };
    wallet_modal_closed: {
        modal: string;
        duration_ms: number;
    };
};
