import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { siweAuthenticateAtom } from "@/module/listener/atoms/siweAuthenticate";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useCallback, useMemo, useState } from "react";
import type { Hex } from "viem";
import { type SiweMessage, createSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";

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

            // If a field is missing, exit
            if (!siweMessage) {
                setListenerParam(null);
                setIsDialogOpen(false);
                // And exit
                return;
            }

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

        if (step.key === "login") {
            // todo
            closeDialog();
            return null;
        }

        return (
            <PerformSiweSignatureComponent
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
                onError={(reason) => {
                    listenerParam.emitter({
                        key: "error",
                        reason,
                    });
                    closeDialog();
                }}
                onDiscard={() => {
                    listenerParam.emitter({
                        key: "aborted",
                    });
                    closeDialog();
                }}
            />
        );
    }, [listenerParam, isDialogOpen, closeDialog, step]);

    return {
        onSiweAuthenticateRequest,
        component,
    };
}

/**
 * Component that will be displayed when sending a transaction
 * todo: Should reuse some stuff from the wallet connect modal here (in term of presentation, tx infos etc)
 * @constructor
 */
function PerformSiweSignatureComponent({
    siweMessage,
    context,
    isOpen,
    onSuccess,
    onError,
    onDiscard,
}: {
    siweMessage: SiweMessage;
    context?: string;
    isOpen: boolean;
    onSuccess: (signature: Hex) => void;
    onError: (reason?: string) => void;
    onDiscard: () => void;
}) {
    const { signMessage, isPending } = useSignMessage({
        mutation: {
            // Link success and error hooks
            onSuccess: onSuccess,
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    return (
        <AlertDialog
            open={isOpen}
            text={
                <>
                    <h2>Validate authentication</h2>

                    {/*todo: some siwe info*/}
                    <p>{siweMessage.statement}</p>
                    <p>Domain: {siweMessage.domain}</p>
                    <p>Uri: {siweMessage.uri}</p>

                    {context && <p>{context}</p>}

                    <ButtonRipple
                        disabled={isPending}
                        onClick={() => {
                            signMessage({
                                message: createSiweMessage(siweMessage),
                            });
                        }}
                    >
                        Validate authentication
                    </ButtonRipple>
                    <ButtonRipple
                        disabled={isPending}
                        onClick={() => onDiscard()}
                    >
                        Discard authentication
                    </ButtonRipple>
                </>
            }
        />
    );
}
