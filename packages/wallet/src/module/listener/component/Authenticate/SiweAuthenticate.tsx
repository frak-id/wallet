import { AlertDialog } from "@/module/common/component/AlertDialog";
import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { useMemo } from "react";
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
    onSuccess: (signature: Hex, message: string) => void;
    onError: (reason?: string) => void;
    onDiscard: () => void;
}) {
    const message = useMemo(
        () => createSiweMessage(siweMessage),
        [siweMessage]
    );

    const { signMessage, isPending } = useSignMessage({
        mutation: {
            // Link success and error hooks
            onSuccess: (signature) => onSuccess(signature, message),
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    return (
        <AlertDialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) {
                    onDiscard();
                }
            }}
            title={"Nexus Wallet - Authentication"}
            text={
                <>
                    {context && <p>{context}</p>}

                    {/*todo: some nice and formatted siwe info*/}
                    <p>{siweMessage.statement}</p>
                    <p>Domain: {siweMessage.domain}</p>
                    <p>Uri: {siweMessage.uri}</p>
                </>
            }
            action={
                <AuthFingerprint
                    disabled={isPending}
                    action={() => {
                        signMessage({
                            message,
                        });
                    }}
                >
                    Validate authentication
                </AuthFingerprint>
            }
        />
    );
}
