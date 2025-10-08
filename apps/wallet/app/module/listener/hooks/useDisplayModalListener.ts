import { sessionAtom } from "@/module/common/atoms/session";
import {
    type DisplayedModalStep,
    displayedRpcModalStepsAtom,
    setNewModalAtom,
} from "@/module/listener/modal/atoms/modalEvents";
import {
    clearRpcModalAtom,
    onFinishResultAtom,
} from "@/module/listener/modal/atoms/modalUtils";
import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
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
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { useCallback, useEffect, useRef } from "react";
import { trackGenericEvent } from "../../common/analytics";

type OnDisplayModalRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayModal",
    WalletRpcContext
>;

/**
 * Hook used to listen to the display modal action
 *
 * Note: Context is augmented by middleware with productId, sourceUrl, etc.
 * No need to read from Jotai store.
 */
export function useDisplayModalListener(): OnDisplayModalRequest {
    // Hook used to set the requested listener UI
    const { setRequest } = useListenerUI();

    // Store the current deferred promise for completion
    const currentDeferredRef = useRef<Deferred<ModalRpcStepsResultType> | null>(
        null
    );

    /**
     * Watch for modal completion or dismissal
     * - Resolves the deferred when all steps are completed
     * - Rejects the deferred if modal is dismissed
     * - Cleans up on component unmount
     */
    useEffect(() => {
        // Subscribe to modal state changes
        const unsubscribe = jotaiStore.sub(displayedRpcModalStepsAtom, () => {
            const deferred = currentDeferredRef.current;
            if (!deferred) return;

            // Check if modal is dismissed
            const modalState = jotaiStore.get(displayedRpcModalStepsAtom);
            if (modalState?.dismissed) {
                // User cancelled the modal
                deferred.reject(
                    new FrakRpcError(
                        RpcErrorCodes.clientAborted,
                        "User dismissed the modal"
                    )
                );
                currentDeferredRef.current = null;
                return;
            }
        });

        // Subscribe to completion state
        const unsubscribeFinish = jotaiStore.sub(onFinishResultAtom, () => {
            const deferred = currentDeferredRef.current;
            if (!deferred) return;

            // Check if modal is complete
            const finishResult = jotaiStore.get(onFinishResultAtom);
            if (finishResult) {
                // All steps completed successfully
                deferred.resolve(finishResult);
                currentDeferredRef.current = null;
            }
        });

        // Cleanup on unmount: reject any pending deferred
        return () => {
            unsubscribe();
            unsubscribeFinish();

            // Reject any pending deferred on unmount
            if (currentDeferredRef.current) {
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.clientAborted,
                        "Modal handler component unmounted"
                    )
                );
                currentDeferredRef.current = null;
            }
        };
    }, []);

    return useCallback(
        async (params, _context) => {
            // Context is augmented by middleware - no need to read from store

            // Clean up any existing deferred
            if (currentDeferredRef.current) {
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.internalError,
                        "New modal request superseded previous request"
                    )
                );
                currentDeferredRef.current = null;
            }

            // If no modal to display, early exit
            const steps = params[0];
            if (Object.keys(steps).length === 0) {
                jotaiStore.set(clearRpcModalAtom);
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
            currentDeferredRef.current = deferred;

            // Save the new modal
            jotaiStore.set(setNewModalAtom, {
                // Current step + formatted steps
                currentStep,
                steps: stepsPrepared,
                // Initial result if any
                initialResult: currentResult as ModalRpcStepsResultType,
            });

            const metadata = params[1] ?? {};
            const configMetadata = params[2] ?? {};

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

            // Save it on the listener UI provider
            setRequest({
                // Modal ui specific
                type: "modal",
                metadata,
                steps,
                emitter,
                // Generic ui
                appName: configMetadata?.name,
                logoUrl: metadata?.header?.icon ?? configMetadata?.logoUrl,
                homepageLink: configMetadata?.homepageLink,
                targetInteraction: params[1]?.targetInteraction,
                configMetadata,
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
        [setRequest]
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
    const trackingData: { step: string } = {
        step: currentKey,
    };

    // In case of final step, track the final action
    if (currentKey === "final") {
        const finalStepKey = steps[currentStep].params.action.key;
        if (finalStepKey) {
            trackingData.step = finalStepKey;
        }
    }

    trackGenericEvent("open-modal", trackingData);
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
    const session = jotaiStore.get(sessionAtom);
    const interactionSession = jotaiStore.get(interactionSessionAtom);

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

    // If the steps include openSession, check if user got a current session and an openSession
    if (
        stepsPrepared.find((step) => step.key === "openSession") &&
        session &&
        interactionSession &&
        interactionSession.sessionEnd > Date.now()
    ) {
        // Add the openSession result
        currentResult = {
            ...currentResult,
            openSession: {
                startTimestamp: interactionSession.sessionStart,
                endTimestamp: interactionSession.sessionEnd,
            },
        };
        currentStep++;
    }

    return { currentStep, currentResult };
}

const stepImportanceMap: Record<ModalStepTypes["key"], number> = {
    // Jumpable steps
    login: -2,
    openSession: -1,
    // Normal steps
    siweAuthenticate: 5,
    sendTransaction: 10,
    // Final step
    final: 100,
};
