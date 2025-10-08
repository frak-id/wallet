import { sessionAtom } from "@/module/common/atoms/session";
import { useListenerUI } from "@/module/listener/providers/ListenerUiProvider";
import type { WalletRpcContext } from "@/module/listener/types/context";
import { useInteractionSessionStatus } from "@/module/wallet/hook/useInteractionSessionStatus";
import type { IFrameRpcSchema } from "@frak-labs/core-sdk";
import {
    Deferred,
    FrakRpcError,
    RpcErrorCodes,
} from "@frak-labs/frame-connector";
import type {
    ExtractReturnType,
    RpcPromiseHandler,
    RpcResponse,
} from "@frak-labs/frame-connector";
import { useAtomValue } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import { trackGenericEvent } from "../../common/analytics";

type OnDisplayEmbeddedWalletRequest = RpcPromiseHandler<
    IFrameRpcSchema,
    "frak_displayEmbeddedWallet",
    WalletRpcContext
>;

/**
 * Hook used to listen to the display embedded wallet action
 */
export function useDisplayEmbeddedWallet(): OnDisplayEmbeddedWalletRequest {
    // Hook used to set the requested listener UI
    const { setRequest } = useListenerUI();

    // Get the session
    const session = useAtomValue(sessionAtom);

    // Get the session status
    const { address } = useAccount();
    const { data: sessionStatus } = useInteractionSessionStatus({
        address,
    });

    // Store the current deferred promise for completion
    const currentDeferredRef = useRef<Deferred<{ wallet: Hex }> | null>(null);

    /**
     * Watch for user login and active session
     * - Resolves the deferred when user is logged in and has an active session
     * - This handles the completion flow for embedded wallet
     */
    useEffect(() => {
        const deferred = currentDeferredRef.current;
        if (!deferred) return;

        // Check if user is logged in and has an active session
        if (session?.address && sessionStatus) {
            // Resolve the deferred with the wallet address
            deferred.resolve({
                wallet: session.address,
            });
            currentDeferredRef.current = null;
        }
    }, [session?.address, sessionStatus]);

    /**
     * Cleanup on component unmount
     * - Rejects any pending deferred to prevent memory leaks
     */
    useEffect(() => {
        return () => {
            if (currentDeferredRef.current) {
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.clientAborted,
                        "User dismissed the modal"
                    )
                );
                currentDeferredRef.current = null;
            }
        };
    }, []);

    return useCallback(
        async (params) => {
            const configMetadata = params[1];

            // Clean up any existing deferred
            if (currentDeferredRef.current) {
                console.log("arleady got one");
                currentDeferredRef.current.reject(
                    new FrakRpcError(
                        RpcErrorCodes.internalError,
                        "New modal request superseded previous request"
                    )
                );
                currentDeferredRef.current = null;
            }

            // Create a new deferred for this embedded wallet request
            const deferred = new Deferred<{ wallet: Hex }>();
            currentDeferredRef.current = deferred;

            // Create emitter that resolves the deferred
            // This maintains backward compatibility with any legacy code
            const emitter = async (
                response: RpcResponse<
                    ExtractReturnType<
                        IFrameRpcSchema,
                        "frak_displayEmbeddedWallet"
                    >
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

            setRequest({
                // Embedded ui specific
                type: "embedded",
                params: params[0],
                emitter,
                // Generic ui
                appName: configMetadata.name,
                logoUrl: params[0].metadata?.logo ?? configMetadata.logoUrl,
                homepageLink:
                    params[0].metadata?.homepageLink ??
                    configMetadata.homepageLink,
                targetInteraction: params[0].metadata?.targetInteraction,
                i18n: {
                    lang: configMetadata.lang,
                    context: params[0].loggedIn?.action?.key,
                },
                configMetadata,
            });

            trackGenericEvent("open-embedded-wallet", params[0]);

            // Wait for user login via deferred promise
            // This will resolve when session + sessionStatus are available
            return await deferred.promise;
        },
        [setRequest]
    );
}
