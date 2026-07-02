import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { FaceIdIcon } from "@frak-labs/design-system/icons";
import {
    authenticationStore,
    authKey,
    classifyWebauthnError,
    isWebAuthNSupported,
    recoveryHintStorage,
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
 * Layout:
 *  - When a recovery hint exists (Zustand store, or uninstall-resilient
 *    cloud KV hint): primary "Use my account 0x…" + secondary "Connect
 *    another account" (`wallet.login.anotherAccount`).
 *  - When no hint: primary biometric button labeled `wallet.login.button`
 *    ("Use biometrics") — same text as the legacy login flow.
 *  - The "Create a new wallet" action lives on the page header (see the
 *    `<Back>` button on `/login`) which routes to `/register?new=1`.
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

    // A `no-credential` outcome from the silent quick-login means the hint is
    // stale (passkey deleted, or the cloud hint synced to a device that never
    // had the credential). Clear both hint sources and refresh the query so the
    // UI settles on the no-hint manual layout — no error toast. Any other
    // failure (e.g. user cancelled) routes through the normal `onError` toast.
    //
    // Deliberately NOT async: TanStack Query awaits `onError` before moving the
    // mutation out of `pending`, so awaiting the native hint wipe / query
    // refetch here would pin `isSilentLoading` (and the button spinners) on any
    // stalled invoke. The zustand clear below flips the UI synchronously; the
    // cloud wipe + invalidation are best-effort background cleanup.
    const handleSilentError = useCallback(
        (error: Error) => {
            if (classifyWebauthnError(error).kind !== "no-credential") {
                onError(error);
                return;
            }
            authenticationStore.getState().setLastAuthenticator(null);
            void recoveryHintStorage
                .clear()
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
        [onError, queryClient]
    );

    // The silent attempt's pending state is tracked locally from the mutation
    // promise instead of `useLogin`'s `isLoading`: that flag comes from the
    // mutation OBSERVER, and an auto-fired mutation is in flight during React
    // StrictMode's simulated unmount — the teardown detaches the observer from
    // the running mutation and resubscription never re-attaches it, freezing
    // `isPending` at `true` (perma-spinner). The promise we already hold always
    // settles, observer or not.
    const [isSilentPending, setIsSilentPending] = useState(false);
    const { login: silentLogin } = useLogin({
        onSuccess: () => onSuccess(),
        onError: handleSilentError,
    });

    // Fire the silent quick-login at most once per mount, and only once a hint
    // has resolved. Gating on hint-existence keeps fresh installs (no hint)
    // from ever seeing an unexpected biometric prompt. Tauri-only: on web the
    // preferImmediatelyAvailable flag is inert, so a stale hint would open a
    // full browser passkey modal and fail as `cancelled` (toast, no self-heal)
    // instead of failing fast onto `no-credential`.
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
        // No `auth_login_method_selected` here: that event signals a user's
        // explicit method choice, which the auto-fire is not. The attempt and
        // its outcome are still tracked via useLogin's `auth_login` flow.
        // `silentLogin` is `mutateAsync` — it rejects on failure even though
        // `handleSilentError` already handles the outcome. Swallow the returned
        // rejection so the routine no-credential / cancelled paths don't surface
        // as unhandled promise rejections on every mount.
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
