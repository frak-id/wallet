import type {
    IFrameRpcSchema,
    ModalRpcRequest,
    ModalRpcResponse,
    RpcResponse,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

export type ModalDisplayedRequest = {
    modal: ModalRpcRequest;
    context?: string;
    emitter: (
        response: RpcResponse<IFrameRpcSchema, "frak_displayModal">
    ) => Promise<void>;
};

/**
 * The currently displayed listener request
 */
export const modalDisplayedRequestAtom = atom<ModalDisplayedRequest | null>(
    null
);

/**
 * The modal steps
 */
export const modalStepsAtom = atom<{
    // Global modal context
    context?: string;
    // Index of the current step in our step array
    currentStep: number;
    // All the steps, with returns marked as optional
    steps: ModalRpcRequest["steps"];
    // todo: All the step results
    results: ModalRpcResponse["results"];
} | null>(null);

/**
 * Simple atom to read the current step
 */
export const currentModalStepAtom = atom((get) => {
    const steps = get(modalStepsAtom);
    return steps?.steps[steps.currentStep];
});

/**
 * Setter for when we receive a new modal request
 */
export const setNewModalAtom = atom(
    null,
    (_get, set, newModal: ModalDisplayedRequest) => {
        set(modalDisplayedRequestAtom, newModal);
        set(modalStepsAtom, {
            currentStep: 0,
            steps: newModal.modal.steps,
            results: [],
        });
    }
);

/**
 * Clear a received rpc modal
 */
export const clearRpcModalAtom = atom(null, (_get, set) => {
    set(modalDisplayedRequestAtom, null);
    set(modalStepsAtom, null);
});
