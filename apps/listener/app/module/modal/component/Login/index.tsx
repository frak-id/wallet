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
import {
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared/stores/sessionStore";
import { useEffect, useMemo, useRef } from "react";
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

    const session = useStore(sessionStore, selectSession);

    // TODO(last-authenticator-store): recovering the credential from
    // sessionStore.session is fragile — that object is cleared/replaced by many
    // flows (logout, backup restore, SSO). Introduce a dedicated "last
    // authenticator" store, generified to either a local webauthn
    // `authenticatorId` or a remote `{ pairingId, authenticatorId }`, mirroring
    // the wallet app's useLastAuthenticatorHint, so the listener can reliably
    // resume / re-auth a session regardless of sessionStore state.

    // Capture the session present at mount time. The `useEffect` below must
    // NOT auto-finish for that session — it may be a stale (dead-token) object
    // that triggered this very login step. We only auto-finish when a NEW
    // session appears (e.g. the user completed SSO in a popup, or phone
    // pairing delivered a fresh session from another device).
    const initialSessionRef = useRef(session);

    // Build the WebAuthn allowCredentials hint for the passkey button.
    // When a dead-token session is in the store we scope to its authenticatorId
    // so the browser presents the correct credential — matching the wallet
    // app's ReauthModal behaviour. First-login (session === null) stays global.
    // Distant (paired) sessions are NOT scoped: their authenticatorId lives on
    // the remote device, so a local WebAuthn assertion against it can't succeed
    // — those re-login via SSO / phone pairing, not the local passkey button.
    const scopedLoginArgs = useMemo(() => {
        const cred =
            session?.type === "distant-webauthn"
                ? undefined
                : session?.authenticatorId;
        if (cred) {
            return { allowedCredentialIds: [cred] };
        }
        return {};
    }, [session]);

    const { login, isSuccess, isLoading, error } = useLogin({
        // On success, transmit the wallet address up a level.
        // webauthnProof is optional in the SDK type; we no longer cache the
        // raw WebAuthn signature (lastWebAuthnAction was removed in the token
        // refactor — see packages/wallet-shared IMPLEMENTATION_PLAN.md).
        onSuccess: (session) => {
            onFinish({ wallet: session.address, webauthnProof: undefined });
        },
    });

    /**
     * Listen to the session status, and exit directly after a NEW session is
     * set in the storage.
     * - Will be triggered if the user goes through the external registration
     *   process (SSO popup, phone pairing, etc.).
     * - Must NOT fire on mount when a stale (dead-token) session is already in
     *   the store — that session is what caused this login step to be shown.
     */
    useEffect(() => {
        if (session && session !== initialSessionRef.current) {
            // webauthnProof is optional; see onSuccess comment above.
            onFinish({ wallet: session.address, webauthnProof: undefined });
        }
    }, [onFinish, session]);

    // Surface login errors in the top modal toast (same UX as the wallet app).
    useWebauthnErrorToast(error, {
        operation: "login",
        onRetry: () => login(scopedLoginArgs),
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
                        className={primaryClass}
                        disabled={isLoading || !isWebAuthNSupported}
                        onClick={() => {
                            login(scopedLoginArgs);
                        }}
                    >
                        {isLoading ? (
                            <Spinner size="s" />
                        ) : (
                            <FaceIdIcon width={24} height={24} />
                        )}
                        {t("sdk.modal.login.primaryAction")}
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
