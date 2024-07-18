import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import {
    modalDisplayedRequestAtom,
    setNewModalAtom,
} from "@/module/listener/atoms/modalEvents";
import {
    type ExtractedParametersFromRpc,
    type IFrameRpcSchema,
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
    return useCallback(async (request, emitter) => {
        // If no modal to display, early exit
        const steps = request.params[0];
        if (Object.keys(steps).length === 0) {
            await emitter({
                error: {
                    code: RpcErrorCodes.invalidRequest,
                    message: "No modals to display",
                },
            });
            jotaiStore.set(modalDisplayedRequestAtom, null);
            return;
        }

        // Set our modal
        jotaiStore.set(setNewModalAtom, {
            steps,
            context: request.params[1],
            emitter,
        });
    }, []);
}
