import styles from "@/module/listener/component/Modal/index.module.css";
import type { SiweAuthenticateModalStepType } from "@frak-labs/nexus-sdk/core";
import { prefixGlobalCss } from "@module/utils/prefixGlobalCss";
import { useMemo } from "react";
import { type SiweMessage, createSiweMessage } from "viem/siwe";
import { useAccount, useSignMessage } from "wagmi";

/**
 * The component for the siwe authentication step of a modal
 * @param onClose
 * @constructor
 */
export function SiweAuthenticateModalStep({
    params,
    onFinish,
    onError,
}: {
    params: SiweAuthenticateModalStepType["params"];
    onFinish: (result: SiweAuthenticateModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { metadata } = params;
    const { address, chainId } = useAccount();
    const siweMessage: SiweMessage | undefined = useMemo(() => {
        if (!(address && chainId)) {
            return undefined;
        }
        return {
            ...params.siwe,
            address,
            chainId,
        };
    }, [params, address, chainId]);

    const message = useMemo(
        () => (siweMessage ? createSiweMessage(siweMessage) : "undef"),
        [siweMessage]
    );

    const { signMessage, isPending, isError, error } = useSignMessage({
        mutation: {
            // Link success and error hooks
            onSuccess: (signature) =>
                onFinish({
                    signature,
                    message,
                }),
            onError: (error) => {
                onError(error.message);
            },
        },
    });

    return (
        <>
            {metadata?.description && (
                <div className={prefixGlobalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            <div className={prefixGlobalCss("buttons-wrapper")}>
                <div>
                    <button
                        type={"button"}
                        className={prefixGlobalCss("button-primary")}
                        disabled={isPending}
                        onClick={() => {
                            signMessage({
                                message,
                            });
                        }}
                    >
                        {metadata?.primaryActionText ?? "Authenticate"}
                    </button>
                </div>
            </div>

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
