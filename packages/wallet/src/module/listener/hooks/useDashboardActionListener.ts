import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { dashboardActionListenerAtom } from "@/module/listener/atoms/dashboardActionListener";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useCallback, useState } from "react";

type OnListenToDashboardAction = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_listenToDashboardAction" }
    >
>;

/**
 * Hook used to listen to the dashboard action
 */
export function useDashboardActionListener() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    /**
     * The current dashboard action listener param
     */
    const [listenerParam, setListenerParam] = useAtom(
        dashboardActionListenerAtom
    );

    const doSomething = useCallback(() => {
        listenerParam?.emitter({
            key: "action-successful",
            value: "something",
        });
    }, [listenerParam?.emitter]);

    const doNothing = useCallback(() => {
        listenerParam?.emitter({ key: "no-action" });
    }, [listenerParam?.emitter]);

    /**
     * The function that will be called when a dashboard action is requested
     * @param request
     * @param emitter
     */
    const onDashboardActionListenRequest: OnListenToDashboardAction =
        useCallback(
            async (request, emitter) => {
                // Extract the action and params
                const action = request.params[0];
                const params = request.params[1];

                // If no action present
                if (!action) {
                    setListenerParam(null);
                    // Send the response
                    await emitter({
                        key: "no-action",
                    });
                    // And exit
                    return;
                }

                // Otherwise, save emitter and params
                setListenerParam({
                    action,
                    params,
                    emitter,
                });

                // Do something with the action
                // Open the dialog if the action is open
                setIsDialogOpen(action === "open");
            },
            [setListenerParam]
        );

    return {
        onDashboardActionListenRequest,
        isDialogOpen,
        doSomething,
        doNothing,
    };
}
