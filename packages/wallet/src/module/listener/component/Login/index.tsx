import { authenticatedBackendApi } from "@/context/common/backendClient";
import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { useConsumePendingSso } from "@/module/authentication/hook/useConsumePendingSso";
import {
    ssoPopupFeatures,
    ssoPopupName,
    useSsoLink,
} from "@/module/authentication/hook/useGetOpenSsoLink";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { sessionAtom } from "@/module/common/atoms/session";
import { RequireWebAuthN } from "@/module/common/component/RequireWebAuthN";
import { modalDisplayedRequestAtom } from "@/module/listener/atoms/modalEvents";
import styles from "@/module/listener/component/Modal/index.module.css";
import { getSafeSession } from "@/module/listener/utils/localStorage";
import { getSharedStorageAccessStatus } from "@/module/listener/utils/thirdParties";
import type {
    LoginModalStepType,
    SsoMetadata,
} from "@frak-labs/nexus-sdk/core";
import { jotaiStore } from "@module/atoms/store";
import { Spinner } from "@module/component/Spinner";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useAtomValue } from "jotai/index";
import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useModalTranslation } from "../../hooks/useModalTranslation";
import { DismissButton } from "../Generic";

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
    const { t } = useModalTranslation();
    const { metadata } = params;
    const { login, isSuccess, isLoading, isError, error } = useLogin({
        // On error, transmit the error up a level
        onError: (error) => onError(error.message),
        // On success, transmit the wallet address up a level
        onSuccess: (session) => onFinish({ wallet: session.address }),
    });
    const { data: hasStorageAccess } = useQuery({
        queryKey: ["storage", "access"],
        queryFn: () => getSharedStorageAccessStatus(),
    });

    const { mutateAsyncUpdateSessionStatus } = useUpdateSessionStatus();

    const session = useAtomValue(sessionAtom);

    /**
     * Listen to the session status, and exit directly after a session is set in the storage
     *  - Will be triggered if the user goes through the external registration process
     */
    useEffect(() => {
        if (session) {
            onFinish({ wallet: session.address });
        }
    }, [onFinish, session]);

    return (
        <RequireWebAuthN>
            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                {params.allowSso && (
                    <div>
                        <SsoButton
                            appName={appName}
                            context={context}
                            ssoMetadata={params.ssoMetadata}
                            alternateText={metadata?.primaryActionText}
                        />
                    </div>
                )}
                <div>
                    <button
                        type={"button"}
                        className={`${styles.modalListener__buttonSecondary} ${prefixModalCss("button-secondary")}`}
                        disabled={isLoading}
                        onClick={() => {
                            // If he already accepted storage access, directly login
                            if (hasStorageAccess) {
                                login({});
                                return;
                            }

                            // Otherwise, ask for storage, then login if needed only
                            document
                                .requestStorageAccess()
                                .then(getSharedStorageAccessStatus)
                                .then(async (hasAccess) => {
                                    // Check for storage access post request
                                    if (hasAccess) {
                                        const session =
                                            await mutateAsyncUpdateSessionStatus();
                                        if (session) {
                                            onFinish({
                                                wallet: session.address,
                                            });
                                            return false;
                                        }
                                    }

                                    // Tell that we should login here
                                    return true;
                                })
                                .catch(() => {
                                    // If we failed to get storage access, we need to login
                                    return true;
                                })
                                .then(async (shouldLogin) => {
                                    if (!shouldLogin) return;

                                    // If we are here, we need to login
                                    await login({});
                                });
                        }}
                    >
                        {isLoading && <Spinner />}
                        {metadata?.secondaryActionText ??
                            t("sdk.modal.login.default.secondaryAction")}
                    </button>
                </div>
                <div>
                    <DismissButton />
                </div>
            </div>

            {isSuccess && (
                <p className={styles.modalListener__success}>
                    {t("sdk.modal.login.success")}
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
    const { t } = useModalTranslation();
    // Target language
    const lang = useAtomValue(modalDisplayedRequestAtom)?.metadata?.lang;

    // Get the link to use with the SSO
    const { link, trackingId } = useSsoLink({
        productId: context.productId,
        metadata: {
            name: appName,
            ...ssoMetadata,
        },
        directExit: true,
        useConsumeKey: true,
        lang,
    });

    // Consume the pending sso if possible (maybe some hook to early exit here? Already working since we have the session listener)
    useConsumePendingSso({
        trackingId,
        productId: context.productId,
    });

    // The text to display on the button
    const text = useMemo<ReactNode>(
        () => alternateText ?? t("sdk.modal.login.default.primaryAction"),
        [alternateText, t]
    );

    if (!link) {
        return null;
    }

    return <RegularSsoButton link={link} text={text} />;
}

function RegularSsoButton({ link, text }: { link: string; text: ReactNode }) {
    const { mutateAsyncUpdateSessionStatus } = useUpdateSessionStatus();
    const [failToOpen, setFailToOpen] = useState(false);
    const [hasClicked, setHasClicked] = useState(false);

    // If we failed to open the SSO modal, fallback to a link
    if (failToOpen) {
        return (
            <>
                <LinkSsoButton link={link} text={text} />
            </>
        );
    }

    return (
        <button
            type={"button"}
            className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
            onClick={() => {
                // Try to open the sso window
                const openedWindow = window.open(
                    link,
                    ssoPopupName,
                    ssoPopupFeatures
                );
                // If we got a window, focus it and save the clicked state
                if (openedWindow) {
                    openedWindow.focus();
                    setHasClicked(true);
                } else {
                    // Otherwise, mark that we fail to open it
                    setFailToOpen(true);
                }
            }}
            onFocus={() => {
                // If the user didn't clicked the button, do nothing
                if (!hasClicked) return;

                // On refocus, recheck the storage access status
                getSharedStorageAccessStatus().then(async (hasAccess) => {
                    // If we have access, we can update the session status
                    if (hasAccess) {
                        await mutateAsyncUpdateSessionStatus();
                    }
                });
            }}
        >
            {text}
        </button>
    );
}

/**
 * SSO button using a simple link, with sharing stauts
 */
function LinkSsoButton({ link, text }: { link: string; text: ReactNode }) {
    const { mutateAsyncUpdateSessionStatus } = useUpdateSessionStatus();
    const [hasClicked, setHasClicked] = useState(false);

    return (
        <a
            href={link}
            onClick={() => {
                setHasClicked(true);
            }}
            className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
            target="frak-sso"
            rel="noreferrer"
            onFocus={() => {
                // If the user didn't clicked the button, do nothing
                if (!hasClicked) return;

                // On refocus, recheck the storage access status
                getSharedStorageAccessStatus().then(async (hasAccess) => {
                    // If we have access, we can update the session status
                    if (hasAccess) {
                        await mutateAsyncUpdateSessionStatus();
                    }
                });
            }}
        >
            {text}
        </a>
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
            const currentSession = getSafeSession();
            if (currentSession) {
                return currentSession;
            }

            // Otherwise we fetch the session
            const { data: session } =
                await authenticatedBackendApi.auth.wallet.session.get();
            if (session) {
                jotaiStore.set(sessionAtom, session);
            }

            return session;
        },
    });

    return { mutateAsyncUpdateSessionStatus };
}
