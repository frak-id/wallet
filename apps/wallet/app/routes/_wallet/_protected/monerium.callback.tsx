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

    const { mutate, isError } = useMutation({
        mutationFn: async ({
            code,
            codeVerifier,
        }: {
            code: string;
            codeVerifier: string;
        }) => {
            const tokens = await exchangeCodeForTokens(code, codeVerifier);
            moneriumStore
                .getState()
                .setTokens(
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_in
                );
            moneriumStore.getState().setPendingCodeVerifier(null);
        },
        onSuccess: () => {
            window.location.replace("/wallet");
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

    // When we have a code but no verifier in the store (tab reload,
    // cleared storage, etc.) the mutation can never run — surface an
    // error instead of spinning forever.
    const isMissingVerifier = Boolean(code) && !pendingCodeVerifier;
    const isExchangingCode = Boolean(code) && !isError && !isMissingVerifier;

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
