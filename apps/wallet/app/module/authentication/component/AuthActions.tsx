import { IS_ANDROID, IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { ConfirmationTooltip } from "@frak-labs/design-system/components/ConfirmationTooltip";
import { Text } from "@frak-labs/design-system/components/Text";
import { ToastSurface } from "@frak-labs/design-system/components/ToastSurface";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    authKey,
    classifyWebauthnError,
    clearLastAuthenticator,
    isWebAuthNSupported,
    trackEvent,
    useLogin,
} from "@frak-labs/wallet-shared";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Trans, useTranslation } from "react-i18next";
import { useLastAuthenticatorHint } from "@/module/authentication/hook/useLastAuthenticatorHint";
import * as styles from "./AuthActions.css";

// Beat before the auto-reconnect login fires, so the "Reconnecting…" toast is
// readable before the OS biometric sheet appears instead of it popping
// unannounced on mount.
const AUTO_RECONNECT_DELAY_MS = 800;

type AuthActionsProps = {
    onSuccess: () => void;
    onError: (error: Error | null) => void;
    isLoading?: boolean;
    className?: string;
};

/**
 * Login actions rendered on the `/login` page.
 *
 *  - Hint present (zustand or cloud KV): "Use my account 0x…" + "Connect
 *    another account".
 *  - No hint: single "Use biometrics" button.
 *  - "Create a new wallet" lives on the page header `<Back>` (→ `/register?new=1`).
 */
export function AuthActions({
    onSuccess,
    onError,
    isLoading,
    className,
}: AuthActionsProps) {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const hint = useLastAuthenticatorHint();
    const { login, isLoading: isLoginLoading } = useLogin({
        onSuccess: () => onSuccess(),
        onError: (error: Error) => onError(error),
    });

    // A failed auto-reconnect NEVER toasts: the user didn't initiate it, so any
    // failure just falls through to the manual buttons. The one action we take
    // is self-healing a genuinely stale hint — but ONLY on Android, where
    // `TYPE_NO_CREDENTIAL` reliably means "no passkey here". iOS can't tell that
    // apart from a cancel / not-immediately-available passkey, so we never wipe
    // there.
    //
    // Not async: TanStack Query awaits `onError` before leaving `pending`, so
    // awaiting the cleanup would pin the button spinners on a stalled invoke.
    // `clearLastAuthenticator` nulls zustand synchronously; the cloud + IDB
    // wipes are best-effort background cleanup.
    const handleSilentError = useCallback(
        (error: Error) => {
            if (
                !IS_ANDROID ||
                classifyWebauthnError(error).kind !== "no-credential"
            )
                return;
            trackEvent("auth_login_self_heal", {
                reason: "stale_hint_clear_attempted",
            });
            void clearLastAuthenticator(hint?.wallet)
                .then(() =>
                    queryClient.invalidateQueries({
                        queryKey: authKey.recoveryHint,
                    })
                )
                .catch((cleanupError) => {
                    console.warn(
                        "Silent login hint cleanup failed",
                        cleanupError
                    );
                });
        },
        [queryClient, hint]
    );

    // Track pending from the promise, not `useLogin`'s `isLoading`: under React
    // StrictMode the auto-fired mutation's observer detaches on the simulated
    // unmount and never re-attaches, freezing `isPending` true (perma-spinner).
    const [isSilentPending, setIsSilentPending] = useState(false);
    const { login: silentLogin } = useLogin({
        onSuccess: () => onSuccess(),
        onError: handleSilentError,
    });

    // Fire once per mount, only when a hint exists (so fresh installs never see
    // an unexpected prompt) and only on Tauri (web has no native quick-login).
    const [showReconnectToast, setShowReconnectToast] = useState(false);
    const silentAttempted = useRef(false);
    useEffect(() => {
        if (
            silentAttempted.current ||
            !hint ||
            !isWebAuthNSupported ||
            !IS_TAURI
        )
            return;
        onError(null);
        // Announce the auto-reconnect, then fire after a short beat.
        setShowReconnectToast(true);
        setIsSilentPending(true);
        const timer = setTimeout(() => {
            // Mark fired only here (not at schedule time): under StrictMode the
            // first mount's timer is cancelled by cleanup, and guarding at
            // schedule time would then block the second mount from ever
            // rescheduling — leaving the toast/spinner stuck and login unfired.
            silentAttempted.current = true;
            // Android's silent `preferImmediatelyAvailable` path is reliable
            // (fast, zero-UI when no passkey). On iOS it is not — on prod it
            // rejects even for a usable passkey — so iOS auto-fires a NON-silent
            // full-sheet login, which prompts Face ID reliably (the same call as
            // the manual "Use my account" button). Either way failures route to
            // `handleSilentError`, which never toasts.
            //
            // No `auth_login_method_selected`: that signals an explicit user
            // choice, not an auto-fire. Swallow the `mutateAsync` rejection to
            // avoid unhandled rejections.
            void silentLogin({
                lastAuthentication: hint,
                silentLogin: IS_ANDROID,
                trigger: "auto",
            })
                .catch(() => {})
                .finally(() => {
                    setIsSilentPending(false);
                    setShowReconnectToast(false);
                });
        }, AUTO_RECONNECT_DELAY_MS);
        // Unmount before firing (e.g. success navigated away): cancel so the
        // login never runs and no state update lands on an unmounted component.
        return () => clearTimeout(timer);
    }, [hint, silentLogin, onError]);

    const loading = isLoading || isLoginLoading || isSilentPending;

    if (!isWebAuthNSupported) {
        return (
            <Text as="p" className={className}>
                {t("wallet.openLogin.webauthnNotSupported")}
            </Text>
        );
    }

    const handleUseExisting = () => {
        if (!hint) return;
        onError(null);
        trackEvent("auth_login_method_selected", {
            method: "passkey",
            origin: "existing",
        });
        login({ lastAuthentication: hint });
    };

    const handleAnother = () => {
        onError(null);
        trackEvent("auth_login_method_selected", {
            method: "passkey",
            origin: "another",
        });
        login({});
    };

    const handleEmail = () => {
        onError(null);
        trackEvent("auth_login_method_selected", { method: "email" });
        navigate({ to: "/login/email" });
    };

    return (
        <>
            {showReconnectToast && (
                <ToastSurface className={styles.reconnectToastOffset}>
                    <ConfirmationTooltip
                        icon={<FaceIdIcon width={20} height={20} />}
                    >
                        {t("wallet.login.autoReconnect")}
                    </ConfirmationTooltip>
                </ToastSurface>
            )}
            {hint && (
                <Box>
                    <Button
                        variant="primary"
                        icon={<FaceIdIcon width={24} height={24} />}
                        loading={loading}
                        onClick={handleUseExisting}
                        className={className}
                    >
                        <Trans i18nKey="wallet.login.useMyAccount" />
                    </Button>
                </Box>
            )}
            <Box>
                <Button
                    variant={hint ? "secondary" : "primary"}
                    icon={
                        hint ? undefined : <FaceIdIcon width={24} height={24} />
                    }
                    loading={loading}
                    onClick={handleAnother}
                    className={className}
                >
                    <Trans
                        i18nKey={
                            hint
                                ? "wallet.login.anotherAccount"
                                : "wallet.login.button"
                        }
                    />
                </Button>
            </Box>
            <Box>
                <Button
                    variant="ghost"
                    onClick={handleEmail}
                    disabled={loading}
                    className={className}
                >
                    <Trans i18nKey="wallet.login.useEmail" />
                </Button>
            </Box>
        </>
    );
}
