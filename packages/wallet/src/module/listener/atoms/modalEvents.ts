import { sessionAtom } from "@/module/common/atoms/session";
import type {
    IFrameRpcSchema,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalStepTypes,
    RpcResponse,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

export type ModalDisplayedRequest = {
    steps: ModalRpcStepsInput;
    metadata?: ModalRpcMetadata;
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
    metadata?: ModalRpcMetadata;
    // Key of the current step
    currentStep: number;
    // All the step but in a table, for easier management
    steps: Pick<ModalStepTypes, "key" | "params">[];
    // All the steps results in an array
    results: Pick<ModalStepTypes, "key" | "returns">[];
} | null>(null);

/**
 * Clear a received rpc modal
 */
export const clearRpcModalAtom = atom(null, (_get, set) => {
    set(modalDisplayedRequestAtom, null);
    set(modalStepsAtom, null);
});

/**
 * Setter for when we receive a new modal request
 */
export const setNewModalAtom = atom(
    null,
    (get, set, newModal: ModalDisplayedRequest) => {
        set(modalDisplayedRequestAtom, newModal);

        // Format the steps for our step manager, from { key1: params1, key2 : params2 } to [{key, param}]
        const steps = prepareInputStepsArray(newModal.steps);

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
                    returns: { wallet: session.wallet.address },
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
 * Prepare the input steps array
 * @param steps
 */
function prepareInputStepsArray(steps: ModalRpcStepsInput) {
    // Build the initial array
    const inputSteps = Object.entries(steps).map(([key, params]) => ({
        key,
        params,
    })) as Pick<ModalStepTypes, "key" | "params">[];

    // Sort the steps by importance
    inputSteps.sort(
        (a, b) => stepImportanceMap[a.key] - stepImportanceMap[b.key]
    );

    // Return the sorted array
    return inputSteps;
}

const stepImportanceMap: Record<ModalStepTypes["key"], number> = {
    login: -1,
    siweAuthenticate: 1,
    openSession: 5,
    sendTransaction: 10,
};
