import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { useConsumePendingSso } from "@/module/authentication/hook/useConsumePendingSso";
import {
    ssoPopupFeatures,
    ssoPopupName,
    useSsoLink,
} from "@/module/authentication/hook/useGetOpenSsoLink";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { sessionAtom } from "@/module/common/atoms/session";
import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import { modalDisplayedRequestAtom } from "@/module/listener/modal/atoms/modalEvents";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import type { LoginModalStepType, SsoMetadata } from "@frak-labs/core-sdk";
import { Spinner } from "@module/component/Spinner";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { trackEvent } from "@module/utils/trackEvent";
import { useAtomValue } from "jotai/index";
import { type ReactNode, useEffect, useMemo, useState } from "react";
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
}: {
    appName: string;
    context: IFrameResolvingContext;
    params: LoginModalStepType["params"];
    onFinish: (args: LoginModalStepType["returns"]) => void;
}) {
    const { t } = useListenerTranslation();
    const { metadata, ssoMetadata } = params;

    // Set the allowSso flag to true by default
    const allowSso = params.allowSso ?? true;

    const { login, isSuccess, isLoading, isError, error } = useLogin({
        // On success, transmit the wallet address up a level
        onSuccess: (session) => onFinish({ wallet: session.address }),
    });

    const session = useAtomValue(sessionAtom);

    const isWebAuthnSupported = useIsWebAuthNSupported();

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
        <>
            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                {allowSso && (
                    <div>
                        <SsoButton
                            appName={appName}
                            context={context}
                            ssoMetadata={ssoMetadata ?? {}}
                            alternateText={metadata?.primaryActionText}
                        />
                    </div>
                )}
                {!allowSso && (
                    <div>
                        <button
                            type={"button"}
                            className={`${styles.modalListener__buttonSecondary} ${prefixModalCss("button-secondary")}`}
                            disabled={isLoading || !isWebAuthnSupported}
                            onClick={() => {
                                login({});
                                trackEvent("cta-login");
                            }}
                        >
                            {isLoading && <Spinner />}
                            {metadata?.secondaryActionText ??
                                t("sdk.modal.login.default.secondaryAction")}
                        </button>
                    </div>
                )}

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
    const { t } = useListenerTranslation();
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
    const [failToOpen, setFailToOpen] = useState(false);

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
                } else {
                    // Otherwise, mark that we fail to open it
                    setFailToOpen(true);
                }
                trackEvent("cta-sso");
            }}
        >
            {text}
        </button>
    );
}

/**
 * SSO button using a simple link, with sharing status
 */
function LinkSsoButton({ link, text }: { link: string; text: ReactNode }) {
    return (
        <a
            href={link}
            className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
            target="frak-sso"
            rel="noreferrer"
            onClick={() => {
                trackEvent("cta-sso");
            }}
        >
            {text}
        </a>
    );
}
