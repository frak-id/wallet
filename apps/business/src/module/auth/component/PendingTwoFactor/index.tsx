import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCompletePendingSession } from "@/module/auth/hooks/useCompletePendingSession";
import { safeRedirectTarget } from "@/module/auth/utils/safeRedirect";
import { useAuthStore } from "@/stores/authStore";
import {
    type TwoFactorMethod,
    useTwoFactorStore,
} from "@/stores/twoFactorStore";

/**
 * The Shopify SSO redirect (`#token=…`) carries no methods list — the
 * backend callback only hands back a token (§4.7). Both channels are
 * offered; the backend rejects whichever the account hasn't actually
 * enabled (`NO_EMAIL`, or an inactive TOTP failing verification).
 */
const SHOPIFY_FALLBACK_METHODS: TwoFactorMethod[] = ["email", "totp"];

const routeApi = getRouteApi("/login/2fa");

/**
 * `/login/2fa` (§2, §4.7): completes a pending login — either a password
 * login already stored in `authStore` (methods known, §4.6), or a Shopify
 * SSO callback redirect carrying `#token=…` in the URL hash (never the
 * query string, so the opaque session token never hits server logs /
 * Referer headers).
 */
export function PendingTwoFactor() {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const { redirect } = routeApi.useSearch();
    const requestVerification = useTwoFactorStore(
        (state) => state.requestVerification
    );
    const consumePendingLoginMethods = useTwoFactorStore(
        (state) => state.consumePendingLoginMethods
    );
    const { mutateAsync: completeSession } = useCompletePendingSession();
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const methodsFromPasswordLogin = consumePendingLoginMethods();
        adoptHashTokenIfPresent();

        const token = useAuthStore.getState().token;
        if (!token) {
            navigate({ to: "/login" });
            return;
        }

        void resolveTwoFactor(methodsFromPasswordLogin);

        async function resolveTwoFactor(hashMethods: TwoFactorMethod[] | null) {
            const methods = hashMethods ?? SHOPIFY_FALLBACK_METHODS;
            const verified = await requestVerification(methods);
            if (!verified) {
                useAuthStore.getState().clearAuth();
                navigate({ to: "/login" });
                return;
            }

            try {
                await completeSession();
            } catch {
                // Session resolution failed (backend error, missing current
                // session row, …) — without this the component would sit on
                // its spinner forever. Reset and surface a retryable error.
                useAuthStore.getState().clearAuth();
                navigate({ to: "/login", search: { error: "session" } });
                return;
            }
            navigate({ to: safeRedirectTarget(redirect) });
        }
    }, [
        navigate,
        redirect,
        requestVerification,
        consumePendingLoginMethods,
        completeSession,
    ]);

    return (
        <Stack space="m" align="center">
            <Spinner />
            <Text variant="body" color="secondary">
                {t("auth.twoFactor.pendingHint")}
            </Text>
        </Stack>
    );
}

/**
 * Shopify SSO redirects here with `#token=…` (hash, not query — the fragment
 * never leaves the browser). Adopts it as a pending session before anything
 * else runs; a no-op when a password login already populated the store.
 */
function adoptHashTokenIfPresent(): void {
    const hash = window.location.hash;
    if (!hash.startsWith("#token=")) return;

    const token = decodeURIComponent(hash.slice("#token=".length));
    window.history.replaceState(null, "", window.location.pathname);

    useAuthStore.getState().setAuth({
        token,
        authMethod: "shopify",
        // Real expiry is unknown until `/auth/sessions` resolves post-2FA
        // (`useCompletePendingSession`); a short placeholder just keeps
        // `isAuthenticated()` conservatively false until then.
        expiresAt: Date.now() + 5 * 60 * 1000,
        pending2fa: true,
    });
}
