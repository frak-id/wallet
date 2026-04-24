import { isRunningInProd } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
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

type OutcomeKind = "cancelled" | "error";

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
    const isCancelled = kind === "cancelled";

    return (
        <MoneriumScreen
            onClose={onClose}
            ctaLabel={t("monerium.callback.tryAgain")}
            ctaOnClick={onRetry}
        >
            <Box display={"flex"} flexDirection={"column"} gap={"s"}>
                <Text variant="heading1">
                    {t(
                        isCancelled
                            ? "monerium.callback.cancelledTitle"
                            : "monerium.callback.errorTitle"
                    )}
                </Text>
                <Text variant="body" color="secondary">
                    {t(
                        isCancelled
                            ? "monerium.callback.cancelledDescription"
                            : "monerium.callback.errorDescription"
                    )}
                </Text>
            </Box>
        </MoneriumScreen>
    );
}

function MoneriumCallback() {
    const navigate = useNavigate();
    const { code, error } = Route.useSearch();
    const hasStartedRef = useRef(false);
    const pendingCodeVerifier = moneriumStore(
        (state) => state.pendingCodeVerifier
    );

    const { mutate, isPending, isError, isSuccess } = useMutation({
        mutationFn: async ({
            code,
            codeVerifier,
        }: {
            code: string;
            codeVerifier: string;
        }) => {
            const tokens = await exchangeCodeForTokens(code, codeVerifier);
            // Only set tokens here — the verifier is cleared in `onSuccess`
            // so the subscribed selector doesn't flip `isMissingVerifier`
            // true before react-query flags `isSuccess`, which would flash
            // the error screen between token exchange and redirect.
            moneriumStore
                .getState()
                .setTokens(
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_in
                );
        },
        onSuccess: () => {
            // Re-open the bank-flow modal so `useMoneriumFlowSync` can
            // route the user to the correct post-connect screen
            // (Account Ready / KYC / Wallet link). The modal store is
            // in-memory, so a full-page reload would wipe it — use SPA
            // navigation instead to preserve it.
            modalStore.getState().openModal({ id: "moneriumBankFlow" });
            navigate({ to: "/wallet", replace: true });
            moneriumStore.getState().setPendingCodeVerifier(null);
        },
        onError: (err) => {
            console.error("Monerium callback token exchange failed", err);
        },
    });

    useEffect(() => {
        if (hasStartedRef.current) return;
        if (!code) return;
        if (!pendingCodeVerifier) return;

        hasStartedRef.current = true;
        mutate({ code, codeVerifier: pendingCodeVerifier });
    }, [code, pendingCodeVerifier, mutate]);

    const goToProfile = () => navigate({ to: "/profile", replace: true });
    const goToWallet = () => navigate({ to: "/wallet", replace: true });

    // Spinner states, in order:
    //   1. Mutation is in-flight (`isPending`) or already succeeded
    //      (`isSuccess`, before the /wallet redirect completes)
    //   2. Initial mount before the effect fires: we have both the code
    //      and verifier and no error yet — the exchange is about to start
    //
    // Error states fall through when `code` is present but either no
    // verifier is available (tab reload cleared storage) or the exchange
    // itself failed.
    const isExchangingCode =
        isPending ||
        isSuccess ||
        (Boolean(code) && Boolean(pendingCodeVerifier) && !isError);

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

                const isCancelled = !code && Boolean(error);

                return (
                    <Outcome
                        kind={isCancelled ? "cancelled" : "error"}
                        onRetry={goToProfile}
                        onClose={handleClose}
                    />
                );
            }}
        </DetailOverlay>
    );
}
