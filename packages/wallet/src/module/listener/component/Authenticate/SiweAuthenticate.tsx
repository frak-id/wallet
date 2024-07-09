import { TextData } from "@/module/common/component/TextData";
import { HelpModal } from "@/module/listener/component/Modal";
import styles from "@/module/listener/component/Modal/index.module.css";
import { AuthFingerprint } from "@module/component/AuthFingerprint";
import { useMemo } from "react";
import type { Hex } from "viem";
import { type SiweMessage, createSiweMessage } from "viem/siwe";
import { useSignMessage } from "wagmi";

/**
 * Modal used to perform a siwe signature
 * @param context
 * @param siweMessage
 * @param onSuccess
 * @param onError
 * @constructor
 */
export function SiweAuthenticate({
    context,
    siweMessage,
    onSuccess,
    onError,
}: {
    context?: string;
    siweMessage: SiweMessage;
    onSuccess: (signature: Hex, message: string) => void;
    onError: (reason?: string) => void;
}) {
    const message = useMemo(
        () => createSiweMessage(siweMessage),
        [siweMessage]
    );

    const { signMessage, isPending, isError, error } = useSignMessage({
        mutation: {
            // Link success and error hooks
            onSuccess: (signature) => onSuccess(signature, message),
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    return (
        <>
            <TextData>
                {context && <p>{context}</p>}
                <p>{siweMessage.statement}</p>
                <p>Domain: {siweMessage.domain}</p>
                <p>Uri: {siweMessage.uri}</p>
            </TextData>
            <HelpModal />
            <AuthFingerprint
                className={styles.modalListener__action}
                disabled={isPending}
                action={() => {
                    signMessage({
                        message,
                    });
                }}
            >
                Validate authentication
            </AuthFingerprint>

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
