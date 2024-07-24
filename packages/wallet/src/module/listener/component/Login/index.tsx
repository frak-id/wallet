import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { getSession } from "@/context/session/action/session";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { useOpenSsoPopup } from "@/module/authentication/hook/useOpenSsoPopup";
import { sessionAtom } from "@/module/common/atoms/session";
import styles from "@/module/listener/component/Modal/index.module.css";
import type {
    LoginModalStepType,
    SsoMetadata,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
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
 * @param appName
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
    /**
     * This mutation is used to ensure that post SSO we have a session, not automatically updated
     */
    const { mutate: updateSessionStatus } = useMutation({
        mutationKey: ["session", "force-refetch"],
        mutationFn: async () => {
            // If our jotai store already contain a session, we can early exit
            if (jotaiStore.get(sessionAtom)) {
                return;
            }

            // Otherwise we fetch the session
            const session = await getSession();
            if (session) {
                jotaiStore.set(sessionAtom, session);
            }
        },
    });

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
            onFocus={() => {
                updateSessionStatus();
            }}
        >
            {alternateText ?? "Register"}
        </button>
    );
}
