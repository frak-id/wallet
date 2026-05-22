import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
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
    selectSession,
    sessionStore,
    trackEvent,
    useLogin,
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
    const session = useStore(sessionStore, selectSession);
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

    // When the origin pinned a credential via `authenticatorHint`, the
    // backend will close the WS with `FORBIDDEN` if we join with anything
    // else. Detect the mismatch up-front so the user gets a "switch
    // passkey" prompt instead of a useless join attempt.
    const needsCredentialSwitch = Boolean(
        pairingInfo?.authenticatorHint &&
            session?.authenticatorId !== pairingInfo.authenticatorHint
    );

    const { login, isLoading: isSwitchingCredential } = useLogin();

    const onSwitchCredential = useCallback(async () => {
        if (!pairingInfo?.authenticatorHint) return;
        // Park the current session so the user can recover their original
        // credential if they cancel out without joining. Safe to call
        // unconditionally — refused if a previous snapshot already exists.
        const current = sessionStore.getState();
        if (current.session) {
            sessionStore.getState().parkSession({
                session: current.session,
                sdkSession: current.sdkSession,
            });
        }
        try {
            await login({
                allowedCredentialIds: [pairingInfo.authenticatorHint],
            });
        } catch (err) {
            // If login failed, restore the original session so the user
            // isn't stranded on a half-applied state.
            sessionStore.getState().popSession();
            console.warn("Failed to switch passkey before pairing join", err);
        }
    }, [login, pairingInfo?.authenticatorHint]);

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
                // Keep the newly-switched credential (if any) — the
                // joined pairing is now keyed to it.
                sessionStore.getState().discardPreviousSession();
                client.joinPairing(id, pairingInfo.pairingCode);
            }
            if (action === "cancel") {
                trackEvent("pairing_request_cancelled", {
                    mode: pairingModeTag,
                    duration_ms,
                });
                // Restore the user's original credential if we'd parked
                // it for a switch. No-op when nothing was parked.
                sessionStore.getState().popSession();
                client.disconnect();
            }
            navigate({ to: "/wallet", replace: true });
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
            {needsCredentialSwitch && (
                <Card variant="muted" padding="default">
                    <Stack space="xs">
                        <Text variant="bodySmall" weight="semiBold">
                            {t("wallet.pairing.switchPasskey.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.pairing.switchPasskey.description")}
                        </Text>
                    </Stack>
                </Card>
            )}
            <Stack space="m" className={styles.pairingFooter}>
                {needsCredentialSwitch ? (
                    <Button
                        onClick={() => {
                            void onSwitchCredential();
                        }}
                        loading={isSwitchingCredential}
                        disabled={isSwitchingCredential}
                    >
                        {t("wallet.pairing.switchPasskey.confirm")}
                    </Button>
                ) : (
                    <Button
                        onClick={() => {
                            actionPairing("join");
                        }}
                    >
                        {t("wallet.pairing.confirm")}
                    </Button>
                )}
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
