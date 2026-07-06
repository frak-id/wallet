import { IS_ANDROID, IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
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

    // Self-heal a stale hint (passkey deleted, or cloud hint synced to a device
    // that never had the credential) by clearing all three "last authenticator"
    // surfaces — but ONLY on Android, where `TYPE_NO_CREDENTIAL` reliably means
    // "no passkey here". On iOS the silent `preferImmediatelyAvailable` attempt
    // reports `no-credential` even for a usable iCloud passkey (device-verified:
    // the full-sheet login works), so wiping there would nuke a valid hint on
    // every `/login` visit — keep it and stay quiet instead. Other errors (e.g.
    // user cancelled) route through the normal `onError` toast.
    //
    // Not async: TanStack Query awaits `onError` before leaving `pending`, so
    // awaiting the cleanup would pin the button spinners on a stalled invoke.
    // `clearLastAuthenticator` nulls zustand synchronously; the cloud + IDB
    // wipes are best-effort background cleanup.
    const handleSilentError = useCallback(
        (error: Error) => {
            if (classifyWebauthnError(error).kind !== "no-credential") {
                onError(error);
                return;
            }
            if (!IS_ANDROID) return;
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
        [onError, queryClient, hint]
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
    // an unexpected prompt) and only on Tauri (web's `preferImmediatelyAvailable`
    // is inert — a stale hint would open a full passkey modal instead of failing
    // fast onto `no-credential`).
    const silentAttempted = useRef(false);
    useEffect(() => {
        if (
            silentAttempted.current ||
            !hint ||
            !isWebAuthNSupported ||
            !IS_TAURI
        )
            return;
        silentAttempted.current = true;
        onError(null);
        // No `auth_login_method_selected`: that signals an explicit user choice,
        // not an auto-fire. `handleSilentError` owns the outcome, so swallow the
        // `mutateAsync` rejection to avoid unhandled rejections on every mount.
        setIsSilentPending(true);
        void silentLogin({
            lastAuthentication: hint,
            silentLogin: true,
        })
            .catch(() => {})
            .finally(() => setIsSilentPending(false));
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
