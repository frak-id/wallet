import { useLogin } from "@/module/authentication/hook/useLogin";
import { sessionAtom } from "@/module/common/atoms/session";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { LoginModalStepType } from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { buildRedirectUrl } from "@module/utils/buildRedirectUrl";
import { prefixGlobalCss } from "@module/utils/prefixGlobalCss";
import { useCallback, useEffect } from "react";

/**
 * The component for the login step of a modal
 * @param onClose
 * @constructor
 */
export function LoginModalStep({
    params,
    onFinish,
    onError,
}: {
    params: LoginModalStepType["params"];
    onFinish: (args: LoginModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { metadata } = params;
    const { login, isSuccess, isLoading, isError, error } = useLogin();

    /**
     * Small hook to open the registration page
     * todo: More specified to the modal flow? Transmit some params? Exit just after the success?
     */
    const openRegister = useCallback(() => {
        // If we are on the server side do nothing
        if (window === undefined) return;

        // Get the nexus url
        const nexusUrl = process.env.APP_URL ?? "https://nexus.frak.id/";

        // Open the popup
        const windowFeatures =
            "menubar=no,status=no,scrollbars=no,fullscreen=no,width=500, height=800";
        const openedWindow = window.open(nexusUrl, "nexus", windowFeatures);
        if (openedWindow) {
            openedWindow.focus();
        }
    }, []);

    /**
     * Listen to the session status, and exit directly after a session is set in the storage
     *  - Will be triggered if the user goes through the external registration process
     */
    useEffect(() => {
        const unsub = jotaiStore.sub(sessionAtom, () => {
            const session = jotaiStore.get(sessionAtom);
            if (session) {
                onFinish({ wallet: session.wallet.address });
            }
        });

        return () => {
            unsub();
        };
    }, [onFinish]);

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
                        disabled={isLoading}
                        onClick={() => openRegister()}
                    >
                        {"Register"}
                    </button>
                </div>
                <div>
                    <button
                        type={"button"}
                        className={prefixGlobalCss("button-primary")}
                        disabled={isLoading}
                        onClick={() => {
                            login({})
                                .then((authResult) => {
                                    onFinish({
                                        wallet: authResult.wallet.address,
                                    });
                                })
                                .catch((error) => {
                                    onError(error.message);
                                });
                        }}
                    >
                        {metadata?.primaryActionText ?? "Login"}
                    </button>
                </div>
                {metadata?.secondaryActionText && (
                    <div>
                        <button
                            type={"button"}
                            className={prefixGlobalCss("button-secondary")}
                            onClick={() => {
                                if (!metadata.articleUrl) return;
                                window.parent.location.href = buildRedirectUrl(
                                    window.location.origin,
                                    metadata.articleUrl
                                );
                            }}
                        >
                            {metadata.secondaryActionText}
                        </button>
                    </div>
                )}
            </div>

            {isSuccess && (
                <p className={styles.modalListener__success}>
                    Connection successful
                </p>
            )}

            {isError && error && (
                <p className={`error ${styles.modalListener__error}`}>
                    {error.message}
                </p>
            )}
        </>
    );
}
