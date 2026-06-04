import { create } from "zustand";

export type WebauthnToastOperation = "login" | "register" | "sign";

export type WebauthnErrorToast = {
    /** Monotonic id so a host only dismisses the toast it raised. */
    id: number;
    error: Error;
    operation?: WebauthnToastOperation;
    /** Invoked by the toast's retry action for retryable kinds. */
    onRetry?: () => void;
};

type WebauthnErrorToastState = {
    current: WebauthnErrorToast | null;
    show: (toast: Omit<WebauthnErrorToast, "id">) => number;
    dismiss: (id?: number) => void;
};

let nextId = 0;

/**
 * Single-slot store for the top WebAuthn error toast. Auth flows are mutually
 * exclusive on screen, so one slot is enough; the `id` guard keeps a host from
 * clearing a toast a freshly-mounted screen just raised during a transition.
 */
export const useWebauthnErrorToastStore = create<WebauthnErrorToastState>(
    (set) => ({
        current: null,
        show: (toast) => {
            const id = ++nextId;
            set({ current: { id, ...toast } });
            return id;
        },
        dismiss: (id) =>
            set((state) =>
                id === undefined || state.current?.id === id
                    ? { current: null }
                    : state
            ),
    })
);
