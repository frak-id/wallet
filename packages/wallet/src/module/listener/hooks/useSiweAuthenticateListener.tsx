import { frakChainPocClient } from "@/context/blockchain/provider";
import type { IFrameRequestResolver } from "@/context/sdk/utils/iFrameRequestResolver";
import { iFrameToggleVisibility } from "@/context/sdk/utils/iFrameToggleVisibility";
import { sessionAtom } from "@/module/common/atoms/session";
import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { siweAuthenticateAtom } from "@/module/listener/atoms/siweAuthenticate";
import type {
    ExtractedParametersFromRpc,
    IFrameRpcSchema,
} from "@frak-labs/nexus-sdk/core";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import { useCallback, useMemo, useState } from "react";
import type { Hex } from "viem";
import type { SiweMessage } from "viem/siwe";
import { useSignMessage } from "wagmi";

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
    // Fetch the current user session
    // todo: If not logged in, first step
    const session = useAtomValue(sessionAtom);

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
            const nonce = request.params[0];
            const statement = request.params[1];
            const domain = request.params[2];
            const requestId = request.params[3];
            const context = request.params[4];

            // If a field is missing, exit
            if (!(nonce && statement && domain)) {
                setListenerParam(null);
                setIsDialogOpen(false);
                // And exit
                return;
            }

            // Build the msg to sign and set it
            const siweMessage: SiweMessage = {
                address: "0x",
                chainId: frakChainPocClient.chain.id,
                nonce,
                statement,
                uri: `https://${domain}`,
                domain,
                version: "1",
                requestId,
            };
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

    /**
     * Build the send transaction component
     */
    const component = useMemo(() => {
        if (!listenerParam) {
            return null;
        }

        return (
            <PerformSiweSignatureComponent
                context={listenerParam.context}
                isOpen={isDialogOpen}
                onSuccess={(signature) => {
                    listenerParam.emitter({
                        key: "success",
                        signature,
                        message: listenerParam?.siweMessage,
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
    }, [listenerParam, isDialogOpen, closeDialog]);

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
    isOpen,
    onSuccess,
    onError,
    onDiscard,
}: {
    siweMessage: string;
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

                    <ButtonRipple
                        disabled={isPending}
                        onClick={() => {
                            signMessage({ message: siweMessage });
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
