import { AuthFingerprint } from "@/module/common/component/AuthFingerprint";
import { Panel } from "@/module/common/component/Panel";
import { Title } from "@/module/common/component/Title";
import { ListenerModalHeader } from "@/module/listener/component/Modal";
import styles from "@/module/listener/component/Modal/index.module.css";
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
            <ListenerModalHeader title={"Nexus Wallet - Authentication"} />
            <Panel size={"normal"}>
                <Title>Welcome to your dashboard</Title>
                <br />
                {context && <p>{context}</p>}
                <p>You need to authenticate to proceed.</p>
                <p>{siweMessage.statement}</p>
                <p>Domain: {siweMessage.domain}</p>
                <p>Uri: {siweMessage.uri}</p>
                <p>
                    Need help? Contact us at{" "}
                    <a href="mailto:hello@frak.id">hello@frak.id</a>
                </p>
            </Panel>
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
