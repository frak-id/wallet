import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { recordError } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
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
            throw redirect({ to: "/wallet" });
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
    const [stateMismatch, setStateMismatch] = useState(false);
    const pendingCodeVerifier = moneriumStore((s) => s.pendingCodeVerifier);
    const pendingState = moneriumStore((s) => s.pendingState);

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
            // Re-open the bank flow so `useMoneriumFlowSync` routes to the
            // right post-connect screen. SPA nav (not `window.location`)
            // because the modal store is in-memory.
            modalStore.getState().openModal({ id: "moneriumBankFlow" });
            navigate({ to: "/wallet", replace: true });
            moneriumStore.getState().clearPendingAuth();
        },
        onError: (err) => {
            recordError(err, { source: "monerium_callback" });
        },
    });

    useEffect(() => {
        if (hasStartedRef.current) return;
        if (!code) return;
        if (!pendingCodeVerifier || !pendingState) return;

        hasStartedRef.current = true;

        // CSRF guard: spec requires the returned `state` to match what we
        // stored before the redirect. Mismatch means the callback isn't ours.
        if (state !== pendingState) {
            moneriumStore.getState().clearPendingAuth();
            recordError(new Error("Monerium OAuth state mismatch"), {
                source: "monerium_callback",
            });
            setStateMismatch(true);
            return;
        }

        mutate({ code, codeVerifier: pendingCodeVerifier });
    }, [code, state, pendingCodeVerifier, pendingState, mutate]);

    const goToProfile = () => navigate({ to: "/profile", replace: true });
    const goToWallet = () => navigate({ to: "/wallet", replace: true });

    // Spinner while the exchange is in-flight, just succeeded (before the
    // redirect lands), or about to start (initial mount with code + verifier).
    const isExchangingCode =
        !stateMismatch &&
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
