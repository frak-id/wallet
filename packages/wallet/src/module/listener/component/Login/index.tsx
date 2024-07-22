import { useLogin } from "@/module/authentication/hook/useLogin";
import { useOpenSsoPopup } from "@/module/authentication/hook/useOpenSsoPopup";
import { sessionAtom } from "@/module/common/atoms/session";
import styles from "@/module/listener/component/Modal/index.module.css";
import type { LoginModalStepType } from "@frak-labs/nexus-sdk/core";
import { buildRedirectUrl } from "@module/utils/buildRedirectUrl";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useAtomValue } from "jotai/index";
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
    const openSsoPopup = useOpenSsoPopup();

    /**
     * Small hook to open the registration page
     * todo: More specified to the modal flow? Transmit some params? Exit just after the success?
     */
    const openRegister = useCallback(() => {
        // If we are on the server side do nothing
        if (window === undefined) return;
        if (!params.ssoMetadata) return;

        // Open the SSO popup
        openSsoPopup({
            metadata: {
                name: "register",
                ...params.ssoMetadata,
            },
            directExit: true,
        });
    }, [params, openSsoPopup]);

    const session = useAtomValue(sessionAtom);

    /**
     * Listen to the session status, and exit directly after a session is set in the storage
     *  - Will be triggered if the user goes through the external registration process
     */
    useEffect(() => {
        if (session) {
            onFinish({ wallet: session.wallet.address });
        }
    }, [onFinish, session]);

    return (
        <>
            {metadata?.description && (
                <div className={prefixModalCss("text")}>
                    <p>{metadata.description}</p>
                </div>
            )}
            <div className={prefixModalCss("buttons-wrapper")}>
                <div>
                    <button
                        type={"button"}
                        className={prefixModalCss("button-primary")}
                        disabled={isLoading}
                        onClick={() => openRegister()}
                    >
                        {"Register"}
                    </button>
                </div>
                <div>
                    <button
                        type={"button"}
                        className={prefixModalCss("button-primary")}
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
                            className={prefixModalCss("button-secondary")}
                            onClick={() => {
                                if (!params.articleUrl) return;
                                window.parent.location.href = buildRedirectUrl(
                                    window.location.origin,
                                    params.articleUrl
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
