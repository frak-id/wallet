import { sessionAtom } from "@/module/common/atoms/session";
import { trackEvent } from "@/module/common/utils/trackEvent";
import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import type { IFrameRequestResolver } from "@/module/sdk/utils/iFrameRequestResolver";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/core-sdk";
import { useAtomValue } from "jotai";
import { useCallback, useEffect } from "react";
import { useAccount } from "wagmi";

type OnDisplayEmbeddedWalletRequest = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_displayEmbeddedWallet" }
    >
>;

/**
 * Hook used to listen to the display embedded wallet action
 */
export function useDisplayEmbeddedWallet(): OnDisplayEmbeddedWalletRequest {
    // Hook used to set the requested listener UI
    const { setRequest, currentRequest } = useListenerUI();

    // Get the session
    const session = useAtomValue(sessionAtom);

    // Get the session status
    const { address } = useAccount();
    const { data: sessionStatus } = useInteractionSessionStatus({
        address,
    });

    /**
     * Method when user is logged in and has an active session
     */
    useEffect(() => {
        if (!session?.address || !sessionStatus) return;

        if (currentRequest?.type === "embedded") {
            // Emit the result and exit
            currentRequest?.emitter({
                result: {
                    wallet: session?.address,
                },
            });
        }
    }, [
        currentRequest?.emitter,
        currentRequest?.type,
        session?.address,
        sessionStatus,
    ]);

    return useCallback(
        async (request, _context, emitter) => {
            const configMetadata = request.params[1];

            setRequest({
                // Embedded ui specific
                type: "embedded",
                params: request.params[0],
                emitter,
                // Generic ui
                appName: configMetadata.name,
                logoUrl:
                    request.params[0].metadata?.logo ?? configMetadata.logoUrl,
                homepageLink:
                    request.params[0].metadata?.homepageLink ??
                    configMetadata.homepageLink,
                targetInteraction:
                    request.params[0].metadata?.targetInteraction,
                i18n: {
                    lang: configMetadata.lang,
                    context: request.params[0].loggedIn?.action?.key,
                },
                configMetadata,
            });

            trackEvent("display-embedded-wallet", request.params[0]);
        },
        [setRequest]
    );
}
