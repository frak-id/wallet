import type { IFrameResolvingContext } from "@/context/sdk/utils/iFrameRequestResolver";
import { useLogin } from "@/module/authentication/hook/useLogin";
import { sessionAtom } from "@/module/common/atoms/session";
import { useIsWebAuthNSupported } from "@/module/common/hook/useIsWebAuthNSupported";
import { SsoButton } from "@/module/listener/component/SsoButton";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import { useListenerTranslation } from "@/module/listener/providers/ListenerUiProvider";
import type { LoginModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@module/component/Spinner";
import { prefixModalCss } from "@module/utils/prefixModalCss";
import { trackEvent } from "@module/utils/trackEvent";
import { useAtomValue } from "jotai/index";
import { useEffect } from "react";
import { DismissButton } from "../Generic";

/**
 * The component for the login step of a modal
 * @param onClose
 * @constructor
 */
export function LoginModalStep({
    context,
    params,
    onFinish,
}: {
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
                            productId={context.productId}
                            ssoMetadata={ssoMetadata ?? {}}
                            text={metadata?.primaryActionText}
                            defaultText={t(
                                "sdk.modal.login.default.primaryAction"
                            )}
                            className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
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
