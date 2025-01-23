import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import {
    type DisplayedModalStep,
    setNewModalAtom,
} from "@/module/listener/modal/atoms/modalEvents";
import { clearRpcModalAtom } from "@/module/listener/modal/atoms/modalUtils";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    type ModalRpcStepsInput,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { jotaiStore } from "@module/atoms/store";
import { trackEvent } from "@module/utils/trackEvent";
import { useCallback } from "react";
import { useListenerUI } from "../providers/ListenerUiProvider";

type OnDisplayModalRequest = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_displayModal" }
    >
>;

/**
 * Hook used to listen to the display modal action
 */
export function useDisplayModalListener(): OnDisplayModalRequest {
    // Hook used to set the requested listener UI
    const { setRequest } = useListenerUI();

    return useCallback(
        async (request, context, emitter) => {
            // If no modal to display, early exit
            const steps = request.params[0];
            if (Object.keys(steps).length === 0) {
                await emitter({
                    error: {
                        code: RpcErrorCodes.invalidRequest,
                        message: "No modals to display",
                    },
                });
                jotaiStore.set(clearRpcModalAtom);
                return;
            }

            // Format the steps for our step manager, from { key1: params1, key2 : params2 } to [{key, param}]
            const stepsPrepared = prepareInputStepsArray(
                {
                    appName: request.params[1],
                    context,
                    steps,
                    metadata: request.params[2],
                    emitter,
                }.steps
            );

            // Build our initial result array
            const { currentResult, currentStep } = filterStepsToDo({
                stepsPrepared,
            });

            // Save the new modal
            jotaiStore.set(setNewModalAtom, {
                // Store the global request
                request: {
                    appName: request.params[1],
                    context,
                    steps,
                    metadata: request.params[2],
                    emitter,
                },
                // Current step + formatted steps
                currentStep,
                steps: stepsPrepared,
                // Initial result if any
                initialResult: currentResult as ModalRpcStepsResultType,
            });

            // Save it on the listener UI provider
            setRequest({
                type: "modal",
                appName: request.params[1],
                i18n: {
                    lang: request.params[2]?.lang,
                    context: steps?.final?.action?.key,
                },
            });

            trackModalDisplay(stepsPrepared, currentStep);
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

    trackEvent("display-modal", trackingData);
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
