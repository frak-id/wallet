import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { useOpenSsoPopup } from "@/module/authentication/hook/useOpenSsoPopup";
import { sessionAtom } from "@/module/common/atoms/session";
import styles from "@/module/listener/component/Modal/index.module.css";
import type {
    LoginModalStepType,
    SsoMetadata,
} from "@frak-labs/nexus-sdk/core";
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
    appName,
    context,
    params,
    onFinish,
    onError,
}: {
    appName: string;
    context: IFrameResolvingContext;
    params: LoginModalStepType["params"];
    onFinish: (args: LoginModalStepType["returns"]) => void;
    onError: (reason?: string) => void;
}) {
    const { metadata } = params;
    const { login, isSuccess, isLoading, isError, error } = useLogin();

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
                {params.allowSso && (
                    <div>
                        <SsoButton
                            appName={appName}
                            context={context}
                            ssoMetadata={params.ssoMetadata}
                            alternateText={metadata?.secondaryActionText}
                        />
                    </div>
                )}
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

/**
 * Button used to launch an SSO registration
 * @param context
 * @param ssoMetadata
 * @param alternateText
 * @constructor
 */
function SsoButton({
    appName,
    context,
    ssoMetadata,
    alternateText,
}: {
    appName: string;
    context: IFrameResolvingContext;
    ssoMetadata: SsoMetadata;
    alternateText?: string;
}) {
    const openSsoPopup = useOpenSsoPopup();

    /**
     * Small hook to open the registration page
     */
    const openRegister = useCallback(() => {
        // If we are on the server side do nothing
        if (window === undefined) return;

        // Open the SSO popup
        openSsoPopup({
            productId: context.productId,
            metadata: {
                name: appName,
                ...ssoMetadata,
            },
            directExit: true,
        });
    }, [appName, ssoMetadata, context, openSsoPopup]);

    return (
        <button
            type={"button"}
            className={prefixModalCss("button-secondary")}
            onClick={() => {
                openRegister();
            }}
        >
            {alternateText ?? "Register"}
        </button>
    );
}
