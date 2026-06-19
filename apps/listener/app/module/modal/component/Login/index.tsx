import type { LoginModalStepType } from "@frak-labs/core-sdk";
import { button } from "@frak-labs/design-system/components/Button";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { FaceIdIcon, QrCodeIcon } from "@frak-labs/design-system/icons";
import { useWebauthnErrorToast } from "@frak-labs/wallet-shared/authentication";
import { useLogin } from "@frak-labs/wallet-shared/authentication/hook/useLogin";
import {
    isWebAuthNSupported,
    prefixModalCss,
} from "@frak-labs/wallet-shared/common";
import { authenticationStore } from "@frak-labs/wallet-shared/stores/authenticationStore";
import {
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared/stores/sessionStore";
import { useEffect, useMemo } from "react";
import { useStore } from "zustand";
import { SsoButton } from "@/module/component/SsoButton";
import { DismissButton } from "@/module/modal/component/Generic";
import { resolvingContextStore } from "@/module/stores/resolvingContextStore";
import {
    useListenerTranslation,
    useModalListenerUI,
} from "@/ui/ListenerUiProvider";
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
    const resolvingContext = useStore(
        resolvingContextStore,
        (state) => state.context
    );
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

    const { login, isSuccess, isLoading, error } = useLogin({
        // On success, transmit the wallet address up a level
        onSuccess: (session) => {
            const lastWebAuthN =
                authenticationStore.getState().lastWebAuthNAction;
            const webauthnProof = lastWebAuthN
                ? {
                      challenge: lastWebAuthN.challenge,
                      authenticatorResponse: btoa(
                          JSON.stringify(lastWebAuthN.signature)
                      ),
                  }
                : undefined;
            onFinish({ wallet: session.address, webauthnProof });
        },
    });

    const session = useStore(sessionStore, selectSession);

    /**
     * Listen to the session status, and exit directly after a session is set in the storage
     *  - Will be triggered if the user goes through the external registration process
     */
    useEffect(() => {
        if (session) {
            const lastWebAuthN =
                authenticationStore.getState().lastWebAuthNAction;
            const webauthnProof = lastWebAuthN
                ? {
                      challenge: lastWebAuthN.challenge,
                      authenticatorResponse: btoa(
                          JSON.stringify(lastWebAuthN.signature)
                      ),
                  }
                : undefined;
            onFinish({ wallet: session.address, webauthnProof });
        }
    }, [onFinish, session]);

    // Surface login errors in the top modal toast (same UX as the wallet app).
    useWebauthnErrorToast(error, {
        operation: "login",
        onRetry: () => login({}),
    });

    const primaryClass = `${button({ variant: "primary", size: "large" })} ${prefixModalCss("button-primary")}`;
    const secondaryClass = `${button({ variant: "secondary", size: "large" })} ${prefixModalCss("button-secondary")}`;

    return (
        <>
            <Stack space="m" className={prefixModalCss("buttons-wrapper")}>
                {allowSso && (
                    <SsoButton
                        merchantId={
                            (resolvingContext?.merchantId as `0x${string}`) ??
                            "0x"
                        }
                        ssoMetadata={ssoMetadata}
                        text={
                            <>
                                <FaceIdIcon width={24} height={24} />
                                {t("sdk.modal.login.primaryAction")}
                            </>
                        }
                        className={primaryClass}
                    />
                )}
                <AuthenticateWithPhone
                    text={
                        <>
                            <QrCodeIcon width={24} height={24} />
                            {t("sdk.modal.login.secondaryAction")}
                        </>
                    }
                    className={secondaryClass}
                />
                {!allowSso && (
                    <button
                        type={"button"}
                        className={secondaryClass}
                        disabled={isLoading || !isWebAuthNSupported}
                        onClick={() => {
                            login({});
                        }}
                    >
                        {isLoading ? (
                            <Spinner size="s" />
                        ) : (
                            <FaceIdIcon width={24} height={24} />
                        )}
                        {t("sdk.modal.login.secondaryAction")}
                    </button>
                )}

                <DismissButton />
            </Stack>

            {isSuccess && (
                <Text variant="body" color="success" align="center">
                    {t("sdk.modal.login.success")}
                </Text>
            )}
        </>
    );
}
