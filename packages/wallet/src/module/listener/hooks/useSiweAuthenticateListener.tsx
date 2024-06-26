import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { siweAuthenticateAtom } from "@/module/listener/atoms/siweAuthenticate";
import { SiweLoginModal } from "@/module/listener/component/Authenticate/Login";
import { SiweAuthenticateModal } from "@/module/listener/component/Authenticate/SiweAuthenticate";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";
import type { SiweMessage } from "viem/siwe";
import { useAccount } from "wagmi";

type OnAuthenticateRequest = IFrameRequestResolver<
    Extract<
        ExtractedParametersFromRpc<IFrameRpcSchema>,
        { method: "frak_siweAuthenticate" }
    >
>;

/**
 * Hook used for the SIWE authentication of a user
 * TODO: Multi step process
 *  1. If not logged in -> register or login
 *  2. Then perform the SIWE authentication
 */
export function useSiweAuthenticateListener() {
    const [isDialogOpen, setIsDialogOpen] = useState(false);

    /**
     * The current listener param
     */
    const [listenerParam, setListenerParam] = useAtom(siweAuthenticateAtom);

    /**
     * The function that will be called when a dashboard action is requested
     * @param request
     * @param emitter
     */
    const onSiweAuthenticateRequest: OnAuthenticateRequest = useCallback(
        async (request, emitter) => {
            // Extract the params
            const siweMessage = request.params[0];
            const context = request.params[1];

            // Build the msg to sign and set it
            setListenerParam({
                siweMessage,
                context,
                emitter,
            });

            // Show the iframe
            iFrameToggleVisibility(true);

            // Tell that the dialog is open
            setIsDialogOpen(true);
        },
        [setListenerParam]
    );

    const closeDialog = useCallback(() => {
        setIsDialogOpen(false);
        iFrameToggleVisibility(false);
    }, []);

    const { address, chainId } = useAccount();

    /**
     * Compute the current step
     */
    const step = useMemo(() => {
        if (!listenerParam) {
            return null;
        }

        // If logged in, return the siwe step
        if (address && chainId) {
            const siweMessage: SiweMessage = {
                ...listenerParam.siweMessage,
                address,
                chainId,
            };
            return { key: "siwe", siweMessage } as const;
        }

        // If not logged in, return the siwe step
        return { key: "login" } as const;
    }, [listenerParam, address, chainId]);

    /**
     * Build the send transaction component
     */
    const component = useMemo(() => {
        if (!(step && listenerParam)) {
            return null;
        }

        // Build regular actions
        const onDiscard = () => {
            listenerParam.emitter({
                key: "aborted",
            });
            closeDialog();
        };
        const onError = (reason?: string) => {
            listenerParam.emitter({
                key: "error",
                reason,
            });
            closeDialog();
        };

        // If not logged in, show the login modal
        if (step.key === "login") {
            return (
                <SiweLoginModal
                    isOpen={isDialogOpen}
                    onSuccess={() => {
                        // todo: tmp component telling we are waiting for the login propagation??
                        // todo: The step should be refreshed automatically
                        // todo: But we can have the required info here, maybe force refresh the step here?
                    }}
                    onError={onError}
                    onDiscard={onDiscard}
                />
            );
        }

        // If already logged in, show the SIWE modal
        return (
            <SiweAuthenticateModal
                context={listenerParam.context}
                siweMessage={step.siweMessage}
                isOpen={isDialogOpen}
                onSuccess={(signature) => {
                    listenerParam.emitter({
                        key: "success",
                        signature,
                        message: step.siweMessage,
                    });
                    closeDialog();
                }}
                onError={onError}
                onDiscard={onDiscard}
            />
        );
    }, [listenerParam, isDialogOpen, closeDialog, step]);

    return {
        onSiweAuthenticateRequest,
        component,
    };
}
