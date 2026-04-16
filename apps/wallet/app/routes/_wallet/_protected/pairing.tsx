import { Button } from "@frak-labs/design-system/components/Button";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import {
    CodeInput,
    getTargetPairingClient,
    isPairingNotFoundError,
    usePairingInfo,
} from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { Title } from "@/module/common/component/Title";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import * as styles from "./pairing.css";

export const Route = createFileRoute("/_wallet/_protected/pairing")({
    component: PairingPage,
    validateSearch: (search: Record<string, unknown>) => ({
        mode: typeof search.mode === "string" ? search.mode : undefined,
        id:
            typeof search.id === "string" && search.id.length > 0
                ? search.id
                : undefined,
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
 * Page to pair with the wallet.
 * Reads the pairing ID directly from search params (?id=xxx).
 */
function PairingPage() {
    const client = getTargetPairingClient();
    const { t } = useTranslation();
    const { id, mode } = Route.useSearch();
    const navigate = useNavigate();
    const pairingState = useStore(client.store);
    const {
        data: pairingInfo,
        error: pairingError,
        isError: isPairingError,
        refetch: refetchPairingInfo,
    } = usePairingInfo({
        id,
    });
    const hasPairingCode = Boolean(pairingInfo?.pairingCode?.trim());
    const shouldShowCode = mode !== "embedded" && hasPairingCode;
    const pairingErrorState = getPairingErrorState(
        isPairingError,
        pairingError
    );

    const actionPairing = useCallback(
        (action: "join" | "cancel") => {
            if (action === "join" && id && pairingInfo) {
                client.joinPairing(id, pairingInfo.pairingCode);
            }
            if (action === "cancel") {
                client.disconnect();
            }
            navigate({ to: "/wallet" });
        },
        [navigate, client, pairingInfo, id]
    );

    // No pairing ID provided
    if (!id) {
        return (
            <div>
                <Title size="big" align="center">
                    {t("wallet.pairing.error.title")}
                </Title>
                <p className={styles.pairingError}>
                    <AlertCircle size={24} />
                    {t("wallet.pairing.error.noCode")}
                </p>
            </div>
        );
    }

    // Error state (invalid/expired pairing ID)
    if (pairingErrorState === "not-found") {
        return (
            <div>
                <Title size="big" align="center">
                    {t("wallet.pairing.error.title")}
                </Title>
                <p className={styles.pairingError}>
                    <AlertCircle size={24} />
                    {t("wallet.pairing.error.notFound")}
                </p>
            </div>
        );
    }

    // Transient error state (network/backend issues)
    if (pairingErrorState === "transient") {
        return (
            <div>
                <Title size="big" align="center">
                    {t("wallet.pairing.title")}
                </Title>
                <p className={styles.pairingError}>
                    <AlertCircle size={24} />
                    {t("error.webauthn.generic")}
                </p>
                <div
                    className={`${styles.pairingButtons} ${styles.pairingButtonsSingle}`}
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
            </div>
        );
    }

    // Loading state
    if (!pairingInfo) {
        return (
            <div>
                <PairingHeader />
                <Skeleton />
            </div>
        );
    }

    return (
        <div>
            <PairingHeader />
            <PairingInfo state={pairingState} id={id} />
            {shouldShowCode ? (
                <CodeInput value={pairingInfo.pairingCode} mode="numeric" />
            ) : (
                <p className={styles.pairingNoCodeNotice}>
                    {t("wallet.pairing.noCodeNotice")}
                </p>
            )}
            <div className={styles.pairingButtons}>
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
        </div>
    );
}
