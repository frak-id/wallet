import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { getSession } from "@/context/session/action/session";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { useOpenSsoPopup } from "@/module/authentication/hook/useOpenSsoPopup";
import { sessionAtom } from "@/module/common/atoms/session";
import { RequireWebAuthN } from "@/module/common/component/RequireWebAuthN";
import styles from "@/module/listener/component/Modal/index.module.css";
import { requestAndCheckStorageAccess } from "@/module/listener/utils/thirdParties";
import type {
    LoginModalStepType,
    SsoMetadata,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { Spinner } from "@module/component/Spinner";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation } from "@tanstack/react-query";
import { useAtomValue } from "jotai/index";
import { useCallback, useEffect } from "react";
import Markdown from "react-markdown";
import rehypeExternalLinks from "rehype-external-links";

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
    const { login, isSuccess, isLoading, isError, error } = useLogin({
        // On mutation, request access to the storage and update context if granted
        onMutate: async () => {
            const hasStorageAccess = await requestAndCheckStorageAccess();

            if (hasStorageAccess) {
                const session = await mutateAsyncUpdateSessionStatus();
                if (session) {
                    onFinish({
                        wallet: session.wallet.address,
                    });
                    return;
                }
            }
        },
        // On error, transmit the error up a level
        onError: (error) => onError(error.message),
        // On success, transmit the wallet address up a level
        onSuccess: (session) => onFinish({ wallet: session.wallet.address }),
    });
    const { mutateAsyncUpdateSessionStatus } = useUpdateSessionStatus();

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
        <RequireWebAuthN>
            {metadata?.description && (
                <div className={prefixModalCss("text")}>
                    <Markdown
                        rehypePlugins={[
                            [rehypeExternalLinks, { target: "_blank" }],
                        ]}
                    >
                        {metadata.description}
                    </Markdown>
                </div>
            )}
            <div className={prefixModalCss("buttons-wrapper")}>
                <div>
                    <button
                        type={"button"}
                        className={prefixModalCss("button-primary")}
                        disabled={isLoading}
                        onClick={() => login({})}
                    >
                        {isLoading && <Spinner />}
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
        </RequireWebAuthN>
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
    const { mutateAsyncUpdateSessionStatus } = useUpdateSessionStatus();
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
            onClick={async () => {
                await requestAndCheckStorageAccess();
                openRegister();
            }}
            onFocus={async () => {
                await mutateAsyncUpdateSessionStatus();
            }}
        >
            {alternateText ?? "Register"}
        </button>
    );
}
/**
 * This mutation is used to ensure that post SSO we have a session, not automatically updated
 */
function useUpdateSessionStatus() {
    const { mutateAsync: mutateAsyncUpdateSessionStatus } = useMutation({
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

            return session;
        },
    });

    return { mutateAsyncUpdateSessionStatus };
}
