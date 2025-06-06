import { sessionAtom } from "@/module/common/atoms/session";
import {
    type DisplayedModalStep,
    setNewModalAtom,
} from "@/module/listener/modal/atoms/modalEvents";
import { clearRpcModalAtom } from "@/module/listener/modal/atoms/modalUtils";
import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import type { IFrameRequestResolver } from "@/module/sdk/utils/iFrameRequestResolver";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    type ModalRpcStepsInput,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
    RpcErrorCodes,
} from "@frak-labs/core-sdk";
import { jotaiStore } from "@shared/module/atoms/store";
import { useCallback } from "react";
import { trackGenericEvent } from "../../common/analytics";

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
                    appName: request.params[2]?.name,
                    context,
                    steps,
                    metadata: request.params[1],
                    emitter,
                }.steps
            );

            // Build our initial result array
            const { currentResult, currentStep } = filterStepsToDo({
                stepsPrepared,
            });

            // Save the new modal
            jotaiStore.set(setNewModalAtom, {
                // Current step + formatted steps
                currentStep,
                steps: stepsPrepared,
                // Initial result if any
                initialResult: currentResult as ModalRpcStepsResultType,
            });

            const metadata = request.params[1] ?? {};
            const configMetadata = request.params[2] ?? {};

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
                targetInteraction: request.params[1]?.targetInteraction,
                configMetadata,
                i18n: {
                    lang: configMetadata?.lang,
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
