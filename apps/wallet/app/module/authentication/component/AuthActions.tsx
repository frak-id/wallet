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
    getPasskeyPresence,
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

    // Not async: TanStack Query awaits `onError` before leaving `pending`, so
    // awaiting the cleanup would pin the button spinners on a stalled invoke.
    // `clearLastAuthenticator` nulls zustand synchronously; the cloud + IDB
    // wipes are best-effort background cleanup.
    const clearStaleHint = useCallback(
        (reason: "os_reported_absent" | "stale_hint_clear_attempted") => {
            trackEvent("auth_login_self_heal", { reason });
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

    // A failed auto-reconnect never toasts: the user didn't initiate it, so it
    // falls through to the manual buttons. The one action taken is self-healing
    // a stale hint, and only on Android, where `TYPE_NO_CREDENTIAL` reliably
    // means "no passkey here"; iOS cannot tell that apart from a cancel.
    const handleSilentError = useCallback(
        (error: Error) => {
            if (
                !IS_ANDROID ||
                classifyWebauthnError(error).kind !== "no-credential"
            )
                return;
            clearStaleHint("stale_hint_clear_attempted");
        },
        [clearStaleHint]
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
            const settle = () => {
                setIsSilentPending(false);
                setShowReconnectToast(false);
            };
            // `settle` is in the outer `finally` so a throw still clears the UI.
            void getPasskeyPresence()
                .then((presence) => {
                    if (presence === "absent") {
                        clearStaleHint("os_reported_absent");
                        return;
                    }
                    // `silentLogin` is Android-only: the silent path is
                    // unreliable on iOS, which auto-fires the full-sheet login.
                    return silentLogin({
                        lastAuthentication: hint,
                        silentLogin: IS_ANDROID,
                        trigger: "auto",
                    });
                })
                .catch(() => {})
                .finally(settle);
        }, AUTO_RECONNECT_DELAY_MS);
        // Unmount before firing (e.g. success navigated away): cancel so the
        // login never runs and no state update lands on an unmounted component.
        return () => clearTimeout(timer);
    }, [hint, silentLogin, onError, clearStaleHint]);

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
