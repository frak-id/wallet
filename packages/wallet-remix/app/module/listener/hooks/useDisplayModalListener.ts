import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import {
    type DisplayedModalStep,
    setNewModalAtom,
} from "@/module/listener/atoms/modalEvents";
import { clearRpcModalAtom } from "@/module/listener/atoms/modalUtils";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    type ModalRpcStepsInput,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
    RpcErrorCodes,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { useCallback } from "react";

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
    return useCallback(async (request, context, emitter) => {
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
    }, []);
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
    const openSession = jotaiStore.get(interactionSessionAtom);

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
        openSession
    ) {
        // Add the openSession result
        currentResult = {
            ...currentResult,
            openSession: {
                startTimestamp: openSession.sessionStart,
                endTimestamp: openSession.sessionEnd,
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
