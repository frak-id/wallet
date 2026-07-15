import { Card } from "@frak-labs/design-system/components/Card";
import { ContentBlock } from "@frak-labs/design-system/components/ContentBlock";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import * as loginCardStyles from "@/module/auth/component/LoginMethods/login-card.css";
import { TwoFactorChallengePanel } from "@/module/auth/component/TwoFactorChallengePanel";
import { useCompletePendingSession } from "@/module/auth/hooks/useCompletePendingSession";
import { safeRedirectTarget } from "@/module/auth/utils/safeRedirect";
import { Login } from "@/module/login/component/Login";
import { useAuthStore } from "@/stores/authStore";
import {
    type TwoFactorMethod,
    useTwoFactorStore,
} from "@/stores/twoFactorStore";

/**
 * Fallback hint when a pending (password) login reaches this page without a
 * stored methods list. Only a hint for the initial render — the challenge
 * panel then fetches the account's authoritative enrolled methods and, if
 * there are none, shows the "set up 2FA in Settings" fallback. Shopify SSO
 * never gets here (its session is usable without a login-time challenge).
 */
const DEFAULT_CHALLENGE_METHODS: TwoFactorMethod[] = ["email", "totp"];

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
    // Reactive mirror of the same store request driven by `requestVerification`
    // below — renders the inline challenge panel whenever one is pending, and
    // falls back to a spinner while resolving/completing the session.
    const request = useTwoFactorStore((state) => state.request);
    const resolveVerification = useTwoFactorStore(
        (state) => state.resolveVerification
    );
    const { mutateAsync: completeSession } = useCompletePendingSession();
    const started = useRef(false);

    useEffect(() => {
        if (started.current) return;
        started.current = true;

        const methodsFromPasswordLogin = consumePendingLoginMethods();
        const { isSso } = adoptHashTokenIfPresent();

        const token = useAuthStore.getState().token;
        if (!token) {
            navigate({ to: "/login" });
            return;
        }

        void resolveTwoFactor(methodsFromPasswordLogin, isSso);

        async function resolveTwoFactor(
            hashMethods: TwoFactorMethod[] | null,
            skipChallenge: boolean
        ) {
            // Shopify SSO is the login factor on its own: the session is
            // already usable server-side, so skip the login-time challenge and
            // go straight to completion. Sensitive actions still step up later.
            if (!skipChallenge) {
                const methods = hashMethods ?? DEFAULT_CHALLENGE_METHODS;
                const verified = await requestVerification(methods, "inline");
                if (!verified) {
                    useAuthStore.getState().clearAuth();
                    navigate({ to: "/login" });
                    return;
                }
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
        <Login>
            {/* Same branded card shell as `LoginMethods` so the challenge sits
                in a card identical to the earlier login steps — no layout
                shift / visual discrepancy between the two pages. */}
            <ContentBlock maxWidth="400px" align="left">
                <Card
                    variant="elevated"
                    radius="l"
                    padding="none"
                    className={loginCardStyles.card}
                >
                    {/* Gate on the `inline` presentation specifically: a
                        step-up 401 from a background request could open a
                        `modal` request while this route is mounted — that one
                        belongs to `TwoFactorModal`, not here (never render both
                        surfaces for the same request). */}
                    {request?.presentation === "inline" ? (
                        <TwoFactorChallengePanel
                            methods={request.methods}
                            onVerified={resolveVerification}
                        />
                    ) : (
                        <Stack space="m" align="center">
                            <Spinner />
                            <Text variant="body" color="secondary">
                                {t("auth.twoFactor.pendingHint")}
                            </Text>
                        </Stack>
                    )}
                </Card>
            </ContentBlock>
        </Login>
    );
}

/**
 * Shopify SSO redirects here with `#token=…&sso=1` (hash, not query — the
 * fragment never leaves the browser). The SSO session is usable server-side
 * without a login-time 2FA, so it's adopted as a full (non-pending) session;
 * a no-op when a password login already populated the store.
 */
function adoptHashTokenIfPresent(): { isSso: boolean } {
    const hash = window.location.hash;
    if (!hash.startsWith("#") || !hash.includes("token=")) {
        return { isSso: false };
    }

    const params = new URLSearchParams(hash.slice(1));
    const token = params.get("token");
    if (!token) return { isSso: false };
    // `sso=1` marks a Shopify SSO session: usable immediately (OAuth was the
    // login factor), so adopt it as a full session and skip the challenge.
    const isSso = params.get("sso") === "1";
    window.history.replaceState(null, "", window.location.pathname);

    useAuthStore.getState().setAuth({
        token,
        authMethod: "shopify",
        // Real expiry is unknown until `/auth/sessions` resolves
        // (`useCompletePendingSession`); a short placeholder just keeps
        // `isAuthenticated()` conservatively false until then.
        expiresAt: Date.now() + 5 * 60 * 1000,
        pending2fa: !isSso,
    });

    return { isSso };
}
