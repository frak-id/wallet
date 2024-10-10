import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import type {
    IFrameRpcSchema,
    ModalRpcMetadata,
    ModalRpcStepsInput,
    ModalStepTypes,
    RpcResponse,
} from "@frak-labs/nexus-sdk/core";
import { atom } from "jotai";

export type ModalDisplayedRequest = {
    appName: string;
    context: IFrameResolvingContext;
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
 * Go to the dismissed step in the modal
 */
export const dismissBtnAtom = atom(
    (get) => {
        // Get some info for the dismiss btn
        const modalSteps = get(modalStepsAtom);
        const modalRequest = get(modalDisplayedRequestAtom);
        if (!(modalSteps && modalRequest)) return null;

        const metadata = modalRequest.metadata;
        const dismissStepIndex = modalSteps.steps.findIndex(
            (step) => step.key === "dismissed"
        );
        if (!metadata?.isDismissible || dismissStepIndex === -1) return null;
        if (dismissStepIndex === modalSteps.currentStep) return null;

        return {
            customLbl: metadata.dismissActionTxt,
            index: dismissStepIndex,
        };
    },
    (get, set) => {
        // Go to the dismissed step
        const modalSteps = get(modalStepsAtom);
        if (!modalSteps) return null;
        const dismissStepIndex = modalSteps.steps.findIndex(
            (step) => step.key === "dismissed"
        );
        if (dismissStepIndex === -1) return null;
        set(modalStepsAtom, {
            ...modalSteps,
            currentStep: dismissStepIndex,
        });
    }
);
