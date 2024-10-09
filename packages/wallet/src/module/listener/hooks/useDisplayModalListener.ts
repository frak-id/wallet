import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { sessionAtom } from "@/module/common/atoms/session";
import {
    modalDisplayedRequestAtom,
    modalStepsAtom,
} from "@/module/listener/atoms/modalEvents";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import type { InteractionSession, Session } from "@/types/Session";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
    type ModalRpcStepsInput,
    type ModalStepTypes,
    RpcErrorCodes,
} from "@frak-labs/nexus-sdk/core";
import { useAtomValue, useSetAtom } from "jotai";
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
    const session = useAtomValue(sessionAtom);
    const openSession = useAtomValue(interactionSessionAtom);
    const setModalDisplayedRequest = useSetAtom(modalDisplayedRequestAtom);
    const setModalStepsAtom = useSetAtom(modalStepsAtom);

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
                setModalDisplayedRequest(null);
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
            const { results, currentStep } = filterStepsToDo({
                stepsPrepared,
                session,
                openSession,
            });

            // Set steps for the modal
            setModalStepsAtom({
                currentStep,
                steps: stepsPrepared,
                results,
            });

            // Set our modal
            setModalDisplayedRequest({
                appName: request.params[1],
                context,
                steps,
                metadata: request.params[2],
                emitter,
            });
        },
        [session, openSession, setModalDisplayedRequest, setModalStepsAtom]
    );
}

/**
 * Return the steps to do in the modal
 * @param stepsPrepared
 * @param session
 * @param openSession
 */
function filterStepsToDo({
    stepsPrepared,
    session,
    openSession,
}: {
    stepsPrepared: Pick<ModalStepTypes, "key" | "params">[];
    session: Session | null;
    openSession: InteractionSession | null;
}) {
    // Build our initial result array
    let currentStep = 0;
    const results: Pick<ModalStepTypes, "key" | "returns">[] = [];

    // If the steps include login, check if user got a current session
    if (stepsPrepared.find((step) => step.key === "login") && session) {
        results.push({
            key: "login",
            returns: { wallet: session.wallet.address },
        });
        currentStep++;
    }

    // If the steps include openSession, check if user got a current session and an openSession
    if (
        stepsPrepared.find((step) => step.key === "openSession") &&
        session &&
        openSession
    ) {
        results.push({
            key: "openSession",
            returns: openSession,
        });
        currentStep++;
    }

    return { results, currentStep };
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
    })) as Pick<ModalStepTypes, "key" | "params">[];

    // Sort the steps by importance
    inputSteps.sort(
        (a, b) => stepImportanceMap[a.key] - stepImportanceMap[b.key]
    );

    // Return the sorted array
    return inputSteps;
}

const stepImportanceMap: Record<ModalStepTypes["key"], number> = {
    // Jumpable steps
    login: -2,
    openSession: -1,
    // Normal steps
    siweAuthenticate: 5,
    sendTransaction: 10,
    success: 100,
    notRewarded: 110,
};
