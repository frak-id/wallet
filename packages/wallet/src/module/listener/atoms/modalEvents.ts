import { sessionAtom } from "@/module/common/atoms/session";
import type {
    IFrameRpcSchema,
    ModalRpcStepsInput,
    ModalStepTypes,
    RpcResponse,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

export type ModalDisplayedRequest = {
    steps: ModalRpcStepsInput;
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
    // Key of the current step
    currentStep: number;
    // All the step but in a table, for easier management
    steps: Pick<ModalStepTypes, "key" | "params">[];
    // All the steps results in an array
    results: Pick<ModalStepTypes, "key" | "returns">[];
} | null>(null);

/**
 * Setter for when we receive a new modal request
 */
export const setNewModalAtom = atom(
    null,
    (get, set, newModal: ModalDisplayedRequest) => {
        set(modalDisplayedRequestAtom, newModal);

        // Format the steps for our step manager, from { key1: params1, key2 : params2 } to [{key, param}]
        const steps = Object.entries(newModal.steps).map(([key, params]) => ({
            key,
            params,
        })) as Pick<ModalStepTypes, "key" | "params">[];

        // Build our initial result array
        let currentStep = 0;
        const results: Pick<ModalStepTypes, "key" | "returns">[] = [];

        // If the steps include login, check if user got a current session
        if (steps.find((step) => step.key === "login")) {
            // Check if the user is already logged in or not on mount
            const session = get(sessionAtom);
            if (session) {
                results.push({
                    key: "login",
                    returns: { wallet: session.wallet },
                });
                currentStep++;
            }
        }

        // Set the initial state
        set(modalStepsAtom, {
            currentStep,
            steps: steps,
            results,
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
