import { AlertDialog } from "@/module/common/component/AlertDialog";
import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import type { Hex } from "viem";
import { type SiweMessage, createSiweMessage } from "viem/siwe";
import { useSignMessage } from "wagmi";

/**
 * Modal used to perform a siwe signature
 * @param siweMessage
 * @param context
 * @param isOpen
 * @param onSuccess
 * @param onError
 * @param onDiscard
 * @constructor
 */
export function SiweAuthenticateModal({
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
