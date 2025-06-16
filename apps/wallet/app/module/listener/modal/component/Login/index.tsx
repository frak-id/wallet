import { useLogin } from "@/module/authentication/hook/useLogin";
import { sessionAtom } from "@/module/common/atoms/session";
import { isWebAuthNSupported } from "@/module/common/lib/webauthn";
import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { HandleErrors } from "@/module/listener/component/HandleErrors";
import { SsoButton } from "@/module/listener/component/SsoButton";
import { DismissButton } from "@/module/listener/modal/component/Generic";
import styles from "@/module/listener/modal/component/Modal/index.module.css";
import {
    useListenerTranslation,
    useModalListenerUI,
} from "@/module/listener/providers/ListenerUiProvider";
import type { LoginModalStepType } from "@frak-labs/core-sdk";
import { Spinner } from "@frak-labs/ui/component/Spinner";
import { prefixModalCss } from "@frak-labs/ui/utils/prefixModalCss";
import { useAtomValue } from "jotai";
import { useEffect, useMemo } from "react";
import { AuthenticateWithPhone } from "../AuthenticateWithPhone";

/**
 * The component for the login step of a modal
 * @param onClose
 * @constructor
 */
export function LoginModalStep({
    params,
    onFinish,
}: {
    params: LoginModalStepType["params"];
    onFinish: (args: LoginModalStepType["returns"]) => void;
}) {
    const resolvingContext = useAtomValue(iframeResolvingContextAtom);
    const { t } = useListenerTranslation();
    const {
        currentRequest: { homepageLink, logoUrl },
    } = useModalListenerUI();

    const ssoMetadata = useMemo(() => {
        if (!params.allowSso) return {};

        return {
            logoUrl: params.ssoMetadata?.logoUrl ?? logoUrl,
            homepageLink: params.ssoMetadata?.homepageLink ?? homepageLink,
        };
    }, [params, homepageLink, logoUrl]);

    // Set the allowSso flag to true by default
    const allowSso = params.allowSso ?? true;

    const { login, isSuccess, isLoading, isError, error } = useLogin({
        // On success, transmit the wallet address up a level
        onSuccess: (session) => onFinish({ wallet: session.address }),
    });

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
        <>
            <div
                className={`${styles.modalListener__buttonsWrapper} ${prefixModalCss("buttons-wrapper")}`}
            >
                {allowSso && (
                    <div>
                        <SsoButton
                            productId={resolvingContext?.productId ?? "0x"}
                            ssoMetadata={ssoMetadata}
                            text={t("sdk.modal.login.primaryAction")}
                            className={`${styles.modalListener__buttonPrimary} ${prefixModalCss("button-primary")}`}
                        />
                    </div>
                )}
                <AuthenticateWithPhone
                    text={t("sdk.modal.login.secondaryAction")}
                    className={`${styles.modalListener__buttonSecondary} ${prefixModalCss("button-secondary")}`}
                />
                {!allowSso && (
                    <div>
                        <button
                            type={"button"}
                            className={`${styles.modalListener__buttonSecondary} ${prefixModalCss("button-secondary")}`}
                            disabled={isLoading || !isWebAuthNSupported}
                            onClick={() => {
                                login({});
                            }}
                        >
                            {isLoading && <Spinner />}
                            {t("sdk.modal.login.secondaryAction")}
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

            {isError && error && <HandleErrors error={error} />}
        </>
    );
}
