import { Button } from "@frak-labs/ui/component/Button";
import { Skeleton } from "@frak-labs/ui/component/Skeleton";
import {
    getTargetPairingClient,
    isPairingNotFoundError,
    PairingCode,
    usePairingInfo,
} from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Grid } from "@/module/common/component/Grid";
import { Title } from "@/module/common/component/Title";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import { usePendingPairingInfo } from "@/module/pairing/hook/usePendingPairingInfo";
import styles from "./pairing.module.css";

export const Route = createFileRoute("/_wallet/_protected/pairing")({
    component: PairingPage,
    validateSearch: (search: Record<string, unknown>) => ({
        mode: typeof search.mode === "string" ? search.mode : undefined,
    }),
});

export function getPairingErrorState(
    isPairingError: boolean,
    pairingError: Error | null
): "none" | "not-found" | "transient" {
    if (!isPairingError) {
        return "none";
    }

    if (isPairingNotFoundError(pairingError)) {
        return "not-found";
    }

    return "transient";
}

/**
 * PairingPage
 *
 * Page to pair with the wallet
 *
 * @returns {JSX.Element} The rendered pairing page
 */
function PairingPage() {
    const client = getTargetPairingClient();
    const { t } = useTranslation();
    const { pairingInfo: pendingPairingInfo, resetPairingInfo } =
        usePendingPairingInfo();
    const navigate = useNavigate();
    const { mode } = Route.useSearch();
    const pairingState = useStore(client.store);
    const {
        data: pairingInfo,
        error: pairingError,
        isError: isPairingError,
        refetch: refetchPairingInfo,
    } = usePairingInfo({
        id: pendingPairingInfo?.id,
    });
    const hasPairingCode = Boolean(pairingInfo?.pairingCode?.trim());
    const shouldShowCode = mode !== "embedded" && hasPairingCode;
    const pairingErrorState = getPairingErrorState(
        isPairingError,
        pairingError
    );

    const actionPairing = useCallback(
        (action: "join" | "cancel") => {
            if (action === "join" && pendingPairingInfo && pairingInfo) {
                client.joinPairing(
                    pendingPairingInfo.id,
                    pairingInfo.pairingCode
                );
            }
            if (action === "cancel") {
                client.disconnect();
            }
            resetPairingInfo();
            navigate({ to: "/wallet" });
        },
        [navigate, resetPairingInfo, client, pairingInfo, pendingPairingInfo]
    );

    // No pairing info
    if (!pendingPairingInfo) {
        return (
            <Grid>
                <Title size="big" align="center">
                    {t("wallet.pairing.error.title")}
                </Title>
                <p className={styles.pairing__error}>
                    <AlertCircle size={24} />
                    {t("wallet.pairing.error.noCode")}
                </p>
            </Grid>
        );
    }

    // Error state (invalid/expired pairing ID)
    if (pairingErrorState === "not-found") {
        return (
            <Grid>
                <Title size="big" align="center">
                    {t("wallet.pairing.error.title")}
                </Title>
                <p className={styles.pairing__error}>
                    <AlertCircle size={24} />
                    {t("wallet.pairing.error.notFound")}
                </p>
            </Grid>
        );
    }

    // Transient error state (network/backend issues)
    if (pairingErrorState === "transient") {
        return (
            <Grid>
                <Title size="big" align="center">
                    {t("wallet.pairing.title")}
                </Title>
                <p className={styles.pairing__error}>
                    <AlertCircle size={24} />
                    {t("error.webauthn.generic")}
                </p>
                <div
                    className={`${styles.pairing__buttons} ${styles["pairing__buttons--single"]}`}
                >
                    <Button
                        variant="secondary"
                        onClick={() => {
                            void refetchPairingInfo();
                        }}
                    >
                        {t("wallet.pairing.refresh")}
                    </Button>
                </div>
            </Grid>
        );
    }

    // Loading state
    if (!pairingInfo) {
        return (
            <Grid>
                <PairingHeader />
                <Skeleton />
            </Grid>
        );
    }

    return (
        <Grid>
            <PairingHeader />
            <PairingInfo state={pairingState} id={pendingPairingInfo.id} />
            {shouldShowCode ? (
                <PairingCode code={pairingInfo.pairingCode} />
            ) : (
                <p className={styles.pairing__noCodeNotice}>
                    {t("wallet.pairing.noCodeNotice")}
                </p>
            )}
            <div className={styles.pairing__buttons}>
                <Button
                    variant="secondary"
                    onClick={() => {
                        actionPairing("cancel");
                    }}
                >
                    {t("wallet.pairing.cancel")}
                </Button>
                <Button
                    onClick={() => {
                        actionPairing("join");
                    }}
                >
                    {t("wallet.pairing.confirm")}
                </Button>
            </div>
        </Grid>
    );
}
