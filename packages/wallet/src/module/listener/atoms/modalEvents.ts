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
