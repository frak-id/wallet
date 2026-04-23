import { Button } from "@frak-labs/design-system/components/Button";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import {
    CodeInput,
    getTargetPairingClient,
    isPairingNotFoundError,
    type PairingMode,
    trackEvent,
    usePairingInfo,
} from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { AlertCircle } from "lucide-react";
import { useCallback, useEffect, useRef } from "react";
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
    const pairingModeTag: PairingMode | undefined =
        mode === "embedded" ? "deep_link" : hasPairingCode ? "code" : "qr";
    const viewedAtRef = useRef<number>(Date.now());
    const errorReportedRef = useRef<"not_found" | "transient" | null>(null);

    // Page mount — emit viewed or no_id for funnel analysis
    useEffect(() => {
        if (!id) {
            trackEvent("pairing_request_no_id");
            return;
        }
        trackEvent("pairing_request_viewed", {
            has_id: true,
            mode: pairingModeTag,
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id]);

    // Track transient / not-found errors once each time they occur
    useEffect(() => {
        if (pairingErrorState === "none") {
            errorReportedRef.current = null;
            return;
        }
        const mappedState =
            pairingErrorState === "not-found" ? "not_found" : "transient";
        if (errorReportedRef.current === mappedState) return;
        errorReportedRef.current = mappedState;
        trackEvent("pairing_request_error", {
            error_state: mappedState,
            mode: pairingModeTag,
        });
    }, [pairingErrorState, pairingModeTag]);

    const actionPairing = useCallback(
        (action: "join" | "cancel") => {
            const duration_ms = Date.now() - viewedAtRef.current;
            if (action === "join" && id && pairingInfo) {
                trackEvent("pairing_request_confirmed", {
                    mode: pairingModeTag,
                    duration_ms,
                });
                client.joinPairing(id, pairingInfo.pairingCode);
            }
            if (action === "cancel") {
                trackEvent("pairing_request_cancelled", {
                    mode: pairingModeTag,
                    duration_ms,
                });
                client.disconnect();
            }
            navigate({ to: "/wallet" });
        },
        [navigate, client, pairingInfo, id, pairingModeTag]
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
                            trackEvent("pairing_request_refreshed", {
                                mode: pairingModeTag,
                            });
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
