import type {
    IFrameRpcSchema,
    ModalRpcStepsInput,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import {
    Deferred,
    type ExtractReturnType,
    FrakRpcError,
    RpcErrorCodes,
    type RpcPromiseHandler,
    type RpcResponse,
} from "@frak-labs/frame-connector";
import { sessionStore, trackEvent } from "@frak-labs/wallet-shared";
import { useCallback, useRef } from "react";
import { useListenerUI } from "@/module/providers/ListenerUiProvider";
import { modalStore, selectShouldFinish } from "@/module/stores/modalStore";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import type { DisplayedModalStep } from "@/module/stores/types";
import type { WalletRpcContext } from "@/module/types/context";
import { normalizeTargetInteraction } from "@/module/utils/normalizeTargetInteraction";
import { resolveBackendMetadata } from "@/module/utils/resolveBackendMetadata";

type OnDisplayModalRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayModal",
    WalletRpcContext
>;

/**
 * Hook used to listen to the display modal action
 *
 * Note: Context is augmented by middleware with merchantId, sourceUrl, etc.
 * No need to read from Zustand store.
 */
export function useDisplayModalListener(): OnDisplayModalRequest {
    const { setRequest } = useListenerUI();
    const backendConfig = resolvingContextStore((s) => s.backendSdkConfig);

    // Store the current unsubscribe function for cleanup
    const unsubscribeRef = useRef<(() => void) | null>(null);

    return useCallback(
        async (params, _context) => {
            // Context is augmented by middleware - no need to read from store

            // Clean up any existing subscription
            if (unsubscribeRef.current) {
                unsubscribeRef.current();
                unsubscribeRef.current = null;
            }

            // If no modal to display, early exit
            const steps = params[0];
            if (Object.keys(steps).length === 0) {
                modalStore.getState().clearModal();
                throw new FrakRpcError(
                    RpcErrorCodes.invalidRequest,
                    "No modals to display"
                );
            }

            // Format the steps for our step manager
            const stepsPrepared = prepareInputStepsArray(steps);

            // Build our initial result array
            const { currentResult, currentStep } = filterStepsToDo({
                stepsPrepared,
            });

            // Create a new deferred for this modal request
            const deferred = new Deferred<ModalRpcStepsResultType>();

            // Save the new modal
            modalStore.getState().setNewModal({
                // Current step + formatted steps
                currentStep,
                steps: stepsPrepared,
                // Initial result if any
                initialResult: currentResult as ModalRpcStepsResultType,
            });

            // Subscribe to modal state changes for THIS specific modal
            // This subscription will be cleaned up when modal completes or new modal opens
            const unsubscribe = modalStore.subscribe((state) => {
                // If modal was cleared (no steps), ignore this state change
                if (!state.steps) return;

                // Check if modal is dismissed
                if (state.dismissed) {
                    // User cancelled the modal
                    deferred.reject(
                        new FrakRpcError(
                            RpcErrorCodes.clientAborted,
                            "User dismissed the modal"
                        )
                    );
                    unsubscribe();
                    return;
                }

                // Check if modal is complete using the selector
                const finishResult = selectShouldFinish(state);
                if (finishResult) {
                    // All steps completed successfully
                    deferred.resolve(finishResult);
                    unsubscribe();
                }
            });

            // Store the unsubscribe function for cleanup
            unsubscribeRef.current = unsubscribe;

            const metadata = params[1] ?? {};
            const configMetadata = params[2] ?? {};
            const placementFromParams = params.at(3);
            const placementId =
                typeof placementFromParams === "string"
                    ? placementFromParams
                    : undefined;
            const placement = placementId
                ? backendConfig?.placements?.[placementId]
                : undefined;

            // Create emitter that resolves the deferred
            // This maintains backward compatibility with any legacy code
            const emitter = async (
                response: RpcResponse<
                    ExtractReturnType<IFrameRpcSchema, "frak_displayModal">
                >
            ) => {
                if (response.error) {
                    deferred.reject(
                        new FrakRpcError(
                            response.error.code,
                            response.error.message,
                            response.error.data
                        )
                    );
                } else if (response.result) {
                    deferred.resolve(response.result);
                }
            };

            const resolved = resolveBackendMetadata(
                configMetadata,
                backendConfig
            );

            setRequest({
                type: "modal",
                metadata,
                steps,
                emitter,
                appName: resolved.appName,
                logoUrl: metadata?.header?.icon ?? resolved.logoUrl,
                homepageLink: resolved.homepageLink,
                targetInteraction: normalizeTargetInteraction(
                    placement?.targetInteraction ?? params[1]?.targetInteraction
                ),
                configMetadata,
                placement: placementId,
                i18n: {
                    lang: configMetadata?.lang,
                    context: steps?.final?.action?.key,
                },
            });

            trackModalDisplay(stepsPrepared, currentStep);

            // Wait for modal completion via deferred promise
            // This will either resolve when all steps complete or reject on dismissal
            return await deferred.promise;
        },
        [setRequest, backendConfig]
    );
}

/**
 * Track the display of the modal
 * @param steps
 * @param currentStep
 */
function trackModalDisplay(
    steps: ReturnType<typeof prepareInputStepsArray>,
    currentStep: number
) {
    const currentKey = steps[currentStep].key;
    let entryStep: string = currentKey;

    // In case of final step, track the underlying final-action key
    if (currentKey === "final") {
        const finalStepKey = steps[currentStep].params.action.key;
        if (finalStepKey) {
            entryStep = finalStepKey;
        }
    }

    trackEvent("modal_opened", {
        steps: steps.map((s) => s.key),
        entry_step: entryStep,
    });
}

/**
 * Prepare the input steps array
 * @param steps
 */
function prepareInputStepsArray(steps: ModalRpcStepsInput) {
    // Build the initial array
    const inputSteps = Object.entries(steps).map(([key, params]) => ({
        key,
        params,
    })) as DisplayedModalStep<ModalStepTypes["key"]>[];

    // Sort the steps by importance
    inputSteps.sort(
        (a, b) => stepImportanceMap[a.key] - stepImportanceMap[b.key]
    );

    // Return the sorted array
    return inputSteps;
}

/**
 * Return the steps to do in the modal
 * @param stepsPrepared
 */
function filterStepsToDo({
    stepsPrepared,
}: {
    stepsPrepared: Pick<ModalStepTypes, "key" | "params">[];
}) {
    const session = sessionStore.getState().session;

    // The current result (if already authenticated + session)
    let currentResult: ModalRpcStepsResultType<[]> = {};
    // Build our initial result array
    let currentStep = 0;

    // If the steps include login, check if user got a current session
    if (stepsPrepared.find((step) => step.key === "login") && session) {
        // Add the login result
        currentResult = {
            ...currentResult,
            login: { wallet: session.address },
        };
        currentStep++;
    }

    return { currentStep, currentResult };
}

const stepImportanceMap: Record<ModalStepTypes["key"], number> = {
    // Jumpable steps
    login: -2,
    // Normal steps
    siweAuthenticate: 5,
    sendTransaction: 10,
    // Final step
    final: 100,
};
