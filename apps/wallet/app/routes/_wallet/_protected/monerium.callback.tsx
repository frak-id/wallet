import { Box } from "@frak-labs/design-system/components/Box";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    authenticatedWalletApi,
    recordError,
    trackEvent,
} from "@frak-labs/wallet-shared";
import type { DefaultTranslationKey } from "@frak-labs/wallet-shared/types";
import { useMutation } from "@tanstack/react-query";
import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { DetailOverlay } from "@/module/common/component/DetailOverlay";
import { MoneriumScreen } from "@/module/monerium/component/MoneriumBankFlow/MoneriumScreen";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { isMoneriumEnabled } from "@/module/monerium/utils/moneriumConfig";
import {
    getMoneriumErrorCode,
    unwrapMoneriumResponse,
} from "@/module/monerium/utils/moneriumErrors";
import { modalStore } from "@/module/stores/modalStore";
import * as styles from "./monerium.callback.css";

export const Route = createFileRoute("/_wallet/_protected/monerium/callback")({
    beforeLoad: () => {
        if (!isMoneriumEnabled) {
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

type OutcomeKind = "cancelled" | "expired" | "error";

const OUTCOME_COPY: Record<
    OutcomeKind,
    { title: DefaultTranslationKey; description: DefaultTranslationKey }
> = {
    cancelled: {
        title: "monerium.callback.cancelledTitle",
        description: "monerium.callback.cancelledDescription",
    },
    expired: {
        title: "monerium.callback.expiredTitle",
        description: "monerium.callback.expiredDescription",
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

    const {
        mutate,
        isPending,
        isSuccess,
        error: exchangeError,
    } = useMutation({
        mutationFn: async ({ code, state }: { code: string; state: string }) =>
            unwrapMoneriumResponse(
                await authenticatedWalletApi.monerium.auth.callback.post({
                    code,
                    state,
                })
            ),
        onSuccess: (status, _variables, _result, { client }) => {
            trackEvent("monerium_callback_outcome", { outcome: "exchanged" });
            client.setQueryData(moneriumKey.status, status);
            // SPA navigation, not `window.location`: the modal store is in-memory.
            modalStore.getState().openModal({ id: "moneriumBankFlow" });
            navigate({ to: "/wallet", replace: true });
        },
        onError: (err) => {
            const expired =
                getMoneriumErrorCode(err) === "MONERIUM_AUTH_STATE_INVALID";
            trackEvent("monerium_callback_outcome", {
                outcome: expired ? "session_expired" : "error",
            });
            if (!expired) recordError(err, { source: "monerium_callback" });
        },
    });

    useEffect(() => {
        if (hasStartedRef.current) return;
        hasStartedRef.current = true;

        if (!code || !state) {
            trackEvent("monerium_callback_outcome", {
                outcome: error ? "cancelled" : "no_code",
            });
            return;
        }
        mutate({ code, state });
    }, [code, state, error, mutate]);

    const goToProfile = () => navigate({ to: "/profile", replace: true });
    const goToWallet = () => navigate({ to: "/wallet", replace: true });

    const isExchanging = Boolean(code && state) && !exchangeError;

    return (
        <DetailOverlay
            onClose={goToWallet}
            labelKey="wallet.modal.moneriumCallback.ariaLabel"
        >
            {({ handleClose }) => {
                if (isExchanging || isPending || isSuccess) {
                    return (
                        <div className={styles.spinnerWrap}>
                            <Spinner />
                        </div>
                    );
                }

                const kind: OutcomeKind = exchangeError
                    ? getMoneriumErrorCode(exchangeError) ===
                      "MONERIUM_AUTH_STATE_INVALID"
                        ? "expired"
                        : "error"
                    : error
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
