import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    type MoneriumCallbackOutcome,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { MoneriumScreen } from "@/module/monerium/component/MoneriumBankFlow/MoneriumScreen";
import { moneriumStore } from "@/module/monerium/store/moneriumStore";
import { exchangeCodeForTokens } from "@/module/monerium/utils/moneriumApi";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./monerium.callback.css";

export const Route = createFileRoute("/_wallet/_protected/monerium/callback")({
    beforeLoad: () => {
        if (isRunningInProd) {
            throw redirect({ to: "/wallet", replace: true });
        }
    },
    component: MoneriumCallback,
    validateSearch: (search: Record<string, unknown>) => ({
        code: (search.code as string) || undefined,
        state: (search.state as string) || undefined,
        error: (search.error as string) || undefined,
    }),
});

type OutcomeKind = "cancelled" | "csrf" | "error";

const OUTCOME_COPY: Record<
    OutcomeKind,
    { title: string; description: string }
> = {
    cancelled: {
        title: "monerium.callback.cancelledTitle",
        description: "monerium.callback.cancelledDescription",
    },
    csrf: {
        title: "monerium.callback.csrfTitle",
        description: "monerium.callback.csrfDescription",
    },
    error: {
        title: "monerium.callback.errorTitle",
        description: "monerium.callback.errorDescription",
    },
};

function Outcome({
    kind,
    onRetry,
    onClose,
}: {
    kind: OutcomeKind;
    onRetry: () => void;
    onClose: () => void;
}) {
    const { t } = useTranslation();
    const copy = OUTCOME_COPY[kind];

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.callback.tryAgain")}
            ctaOnClick={onRetry}
        >
            <Box paddingTop={"m"}>
                <Text variant="heading1">{t(copy.title)}</Text>
                <Text variant="body" color="secondary">
                    {t(copy.description)}
                </Text>
            </Box>
        </MoneriumScreen>
    );
}

function MoneriumCallback() {
    const navigate = useNavigate();
    const { code, state, error } = Route.useSearch();
    const hasStartedRef = useRef(false);
    const outcomeFiredRef = useRef(false);
    const [stateMismatch, setStateMismatch] = useState(false);
    const [sessionExpired, setSessionExpired] = useState(false);
    const pendingCodeVerifier = moneriumStore((s) => s.pendingCodeVerifier);
    const pendingState = moneriumStore((s) => s.pendingState);

    // Fire a terminal outcome event at most once per mount — used by the
    // OpenPanel funnel to count `monerium_auth_started` vs final outcomes.
    const trackOutcome = useCallback((outcome: MoneriumCallbackOutcome) => {
        if (outcomeFiredRef.current) return;
        outcomeFiredRef.current = true;
        trackEvent("monerium_callback_outcome", { outcome });
    }, []);

    // Mount-time signal: did the deep-link callback actually reach the SPA,
    // and what state was the store in? On Android, an HTTPS redirect from
    // an OAuth provider can leave AOSP returning `START_TASK_TO_FRONT`
    // instead of `START_DELIVERED_TO_TOP`, so this event simply not firing
    // (while `monerium_auth_started` does) is the diagnostic for that bug.
    useEffect(() => {
        trackEvent("monerium_callback_received", {
            has_code: Boolean(code),
            has_state: Boolean(state),
            has_pending_verifier: Boolean(pendingCodeVerifier),
            has_pending_state: Boolean(pendingState),
            has_error_param: Boolean(error),
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const { mutate, isPending, isError, isSuccess } = useMutation({
        mutationFn: async ({
            code,
            codeVerifier,
        }: {
            code: string;
            codeVerifier: string;
        }) => {
            const tokens = await exchangeCodeForTokens(code, codeVerifier);
            // Pending auth cleared in `onSuccess` — clearing here would flip
            // the subscribed selector before react-query flags `isSuccess`
            // and flash the error screen during the redirect.
            moneriumStore
                .getState()
                .setTokens(
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_in
                );
        },
        onSuccess: () => {
            trackOutcome("exchanged");
            // Re-open the bank flow so `useMoneriumFlowSync` routes to the
            // right post-connect screen. SPA nav (not `window.location`)
            // because the modal store is in-memory.
            modalStore.getState().openModal({ id: "moneriumBankFlow" });
            navigate({ to: "/wallet", replace: true });
            moneriumStore.getState().clearPendingAuth();
        },
        onError: (err) => {
            trackOutcome("error");
            recordError(err, { source: "monerium_callback" });
        },
    });

    useEffect(() => {
        if (hasStartedRef.current) return;
        if (!code) {
            // No code in the callback URL: either the user cancelled (when
            // `error` is set) or the route was hit directly without an
            // OAuth context. Either way, terminal — record once.
            trackOutcome(error ? "cancelled" : "no_code");
            return;
        }
        if (!pendingCodeVerifier || !pendingState) {
            // Code present but our PKCE verifier is gone (already consumed,
            // or store cleared between redirect and callback). Surface as a
            // recoverable error rather than the generic CSRF screen.
            if (!sessionExpired) {
                trackOutcome("session_expired");
                setSessionExpired(true);
            }
            return;
        }

        hasStartedRef.current = true;

        // CSRF guard: spec requires the returned `state` to match what we
        // stored before the redirect. Mismatch means the callback isn't
        // ours — but we deliberately do NOT clear `pendingAuth` here:
        // a mismatch could be a transient race (e.g. double delivery on
        // Android) and clearing would turn it into a permanent error,
        // forcing the user to restart the entire flow. Leaving the
        // verifier in place lets a subsequent valid callback succeed.
        if (state !== pendingState) {
            trackOutcome("csrf_mismatch");
            recordError(new Error("Monerium OAuth state mismatch"), {
                source: "monerium_callback",
            });
            setStateMismatch(true);
            return;
        }

        mutate({ code, codeVerifier: pendingCodeVerifier });
    }, [
        code,
        state,
        pendingCodeVerifier,
        pendingState,
        mutate,
        sessionExpired,
        error,
        trackOutcome,
    ]);

    const goToProfile = () => navigate({ to: "/profile", replace: true });
    const goToWallet = () => navigate({ to: "/wallet", replace: true });

    // Spinner while the exchange is in-flight, just succeeded (before the
    // redirect lands), or about to start (initial mount with code + verifier).
    const isExchangingCode =
        !stateMismatch &&
        !sessionExpired &&
        (isPending ||
            isSuccess ||
            (Boolean(code) &&
                Boolean(pendingCodeVerifier) &&
                Boolean(pendingState) &&
                !isError));

    return (
        <DetailOverlay onClose={goToWallet}>
            {({ handleClose }) => {
                if (isExchangingCode) {
                    return (
                        <div className={styles.spinnerWrap}>
                            <Spinner />
                        </div>
                    );
                }

                const kind: OutcomeKind = stateMismatch
                    ? "csrf"
                    : sessionExpired
                      ? "error"
                      : !code && Boolean(error)
                        ? "cancelled"
                        : "error";

                return (
                    <Outcome
                        kind={kind}
                        onRetry={goToProfile}
                        onClose={handleClose}
                    />
                );
            }}
        </DetailOverlay>
    );
}
