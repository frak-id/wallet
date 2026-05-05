import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { WarningIcon } from "@frak-labs/design-system/icons";
import {
    CodeInput,
    getTargetPairingClient,
    isPairingNotFoundError,
    type PairingMode,
    trackEvent,
    usePairingInfo,
} from "@frak-labs/wallet-shared";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { PairingHeader } from "@/module/pairing/component/PairingHeader";
import { PairingInfo } from "@/module/pairing/component/PairingInfo";
import * as styles from "./pairing.css";

export const Route = createFileRoute("/_wallet/_protected-fullscreen/pairing")({
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
            <Stack space="m">
                <Text as="h1" variant="heading1" align="center">
                    {t("wallet.pairing.error.title")}
                </Text>
                <Inline space="xs" align="center" alignY="center">
                    <WarningIcon width={24} height={24} />
                    <Text as="span">{t("wallet.pairing.error.noCode")}</Text>
                </Inline>
            </Stack>
        );
    }

    // Error state (invalid/expired pairing ID)
    if (pairingErrorState === "not-found") {
        return (
            <Stack space="m">
                <Text as="h1" variant="heading1" align="center">
                    {t("wallet.pairing.error.title")}
                </Text>
                <Inline space="xs" align="center" alignY="center">
                    <WarningIcon width={24} height={24} />
                    <Text as="span">{t("wallet.pairing.error.notFound")}</Text>
                </Inline>
            </Stack>
        );
    }

    // Transient error state (network/backend issues)
    if (pairingErrorState === "transient") {
        return (
            <Stack space="m" className={styles.pairingPage}>
                <Text as="h1" variant="heading1" align="center">
                    {t("wallet.pairing.title")}
                </Text>
                <Inline space="xs" align="center" alignY="center">
                    <WarningIcon width={24} height={24} />
                    <Text as="span">{t("error.webauthn.generic")}</Text>
                </Inline>
                <Stack space="m" className={styles.pairingFooter}>
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
                </Stack>
            </Stack>
        );
    }

    // Loading state
    if (!pairingInfo) {
        return (
            <Stack space="l">
                <PairingHeader />
                <Skeleton />
            </Stack>
        );
    }

    return (
        <Stack space="l" className={styles.pairingPage}>
            <Stack space="l">
                <PairingHeader />
                <PairingInfo
                    state={pairingState}
                    originName={pairingInfo.originName}
                />
                {hasPairingCode ? (
                    <Stack space="m" align="center">
                        <Text variant="body" weight="semiBold" align="center">
                            {t("wallet.pairing.code")}
                        </Text>
                        <CodeInput
                            value={pairingInfo.pairingCode}
                            mode="numeric"
                            fill
                        />
                    </Stack>
                ) : (
                    <Text as="p" align="center">
                        {t("wallet.pairing.noCodeNotice")}
                    </Text>
                )}
            </Stack>
            <Stack space="m" className={styles.pairingFooter}>
                <Button
                    onClick={() => {
                        actionPairing("join");
                    }}
                >
                    {t("wallet.pairing.confirm")}
                </Button>
                <Button
                    variant="secondary"
                    onClick={() => {
                        actionPairing("cancel");
                    }}
                >
                    {t("wallet.pairing.cancel")}
                </Button>
            </Stack>
        </Stack>
    );
}
