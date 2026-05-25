import { WebAuthN } from "@frak-labs/app-essentials";
import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import {
    detachedPairingSessionStore,
    getOriginPairingClient,
    getTauriGetFn,
    PairingQrCode,
    PairingStatus,
} from "@frak-labs/wallet-shared";
import { WebAuthnP256 } from "ox";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { generatePrivateKey } from "viem/accounts";
import { useStore } from "zustand";
import { useShallow } from "zustand/react/shallow";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import * as styles from "../stepLayout.css";

/**
 * Outcome of the discovery race. Whichever path resolves first sets the
 * mode for the rest of the merge flow; the other path is torn down.
 */
export type DiscoveryResolution =
    | {
          mode: "local";
          /** Cred id the OS surfaced for the local probe. */
          targetAuthenticatorId: string;
      }
    | {
          mode: "remote";
          /** Cred id the peer authenticated as on its device. */
          targetAuthenticatorId: string;
          /** Live pairing kept alive for downstream signing steps. */
          pairingId: string;
      };

type DiscoveryStepProps = {
    /**
     * Every credential currently bound to the conflicting wallet. Both
     * probes target this set: the local prompt's `allowCredentials`, the
     * pairing's server-side allow-list.
     */
    targetAuthenticatorIds: string[];
    /** Whichever path wins fires this once, with mode-specific details. */
    onResolved: (result: DiscoveryResolution) => void;
    onAbort: () => void;
};

/**
 * First step of the merge flow. Concurrently advertises two paths to the
 * user — scan the QR with the device holding the other passkey, or
 * authenticate with that passkey here (works when the OS keychain or
 * iCloud sync surfaces it locally) — and lets whichever resolves first
 * decide the mode for the rest of the flow.
 *
 * Pairing is initiated detached on mount: the QR is visible immediately,
 * the live `sessionStore` stays untouched, and if local wins we tear the
 * pairing down. If remote wins the pairing stays live across every
 * subsequent step (its `ensurePairing` gate is status-guarded and a no-op
 * once `"paired"`), so the user only ever sees one QR.
 */
export function DiscoveryStep({
    targetAuthenticatorIds,
    onResolved,
    onAbort,
}: DiscoveryStepProps) {
    const { t } = useTranslation();
    const client = useMemo(() => getOriginPairingClient(), []);
    const { pairing, status } = useStore(
        client.store,
        useShallow((s) => ({ pairing: s.pairing, status: s.status }))
    );
    const settledRef = useRef(false);
    const [localError, setLocalError] = useState<Error | null>(null);
    const [localRunning, setLocalRunning] = useState(false);

    const finishLocal = useCallback(
        (targetAuthenticatorId: string) => {
            if (settledRef.current) return;
            settledRef.current = true;
            client.cancelAllSignatureRequests("merge-discovery-local-won");
            client.softReset();
            detachedPairingSessionStore.getState().clearDetachedSession();
            onResolved({ mode: "local", targetAuthenticatorId });
        },
        [client, onResolved]
    );

    const finishRemote = useCallback(
        (targetAuthenticatorId: string, pairingId: string) => {
            if (settledRef.current) return;
            settledRef.current = true;
            onResolved({ mode: "remote", targetAuthenticatorId, pairingId });
        },
        [onResolved]
    );

    useEffect(() => {
        client.initiatePairing({
            authenticatorHints: targetAuthenticatorIds,
            detached: true,
            onSuccess: () => {
                // `handleAuthenticated` populates the detached store
                // before firing this callback, so the peer's cred id is
                // already there. The pairing id stays on `state.pairing`
                // past `authenticated` for downstream steps.
                const state = client.state;
                const peerAuthId =
                    detachedPairingSessionStore.getState().detached?.session
                        .authenticatorId;
                if (!peerAuthId || !state.pairing?.id) return;
                finishRemote(peerAuthId, state.pairing.id);
            },
        });

        return () => {
            if (settledRef.current) return;
            client.cancelAllSignatureRequests("merge-discovery-aborted");
            client.softReset();
            detachedPairingSessionStore.getState().clearDetachedSession();
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const runLocalProbe = useCallback(async () => {
        if (settledRef.current || localRunning) return;
        setLocalRunning(true);
        setLocalError(null);
        try {
            const tauriGetFn = getTauriGetFn();
            const { raw } = await WebAuthnP256.sign({
                credentialId: targetAuthenticatorIds,
                challenge: generatePrivateKey(),
                rpId: WebAuthN.rpId,
                userVerification: "required",
                ...(tauriGetFn && { getFn: tauriGetFn }),
            });
            if (!targetAuthenticatorIds.includes(raw.id)) {
                throw new Error("MERGE_DISCOVERY_LOCAL_UNEXPECTED_CRED");
            }
            finishLocal(raw.id);
        } catch (err) {
            setLocalError(err instanceof Error ? err : new Error(String(err)));
        } finally {
            setLocalRunning(false);
        }
    }, [targetAuthenticatorIds, finishLocal, localRunning]);

    return (
        <PageLayout
            back={<Back onClick={onAbort} />}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={runLocalProbe}
                        loading={localRunning}
                        disabled={localRunning}
                    >
                        {t("wallet.merge.discovery.useThisDevice")}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {t("wallet.merge.discovery.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.merge.discovery.description")}
                    </Text>
                </Stack>

                {pairing ? (
                    <Box role="status" aria-live="polite">
                        <Stack space="m" align="center">
                            <PairingQrCode
                                value={`${process.env.FRAK_WALLET_URL ?? ""}/p/${pairing.id}`}
                                size={200}
                                errorCorrection="quartile"
                            />
                            <PairingStatus status={status} />
                            <Text variant="bodySmall" color="secondary">
                                {t("wallet.merge.discovery.scanHint")}
                            </Text>
                        </Stack>
                    </Box>
                ) : (
                    <Box role="status" aria-live="polite">
                        <Stack space="m" align="center">
                            <Spinner />
                            <Text variant="bodySmall" color="secondary">
                                {t("wallet.merge.discovery.preparing")}
                            </Text>
                        </Stack>
                    </Box>
                )}

                <Card variant="muted" padding="default">
                    <Stack space="xs">
                        <Text variant="bodySmall" weight="semiBold">
                            {t("wallet.merge.discovery.localHint.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.discovery.localHint.body")}
                        </Text>
                    </Stack>
                </Card>

                {localError && (
                    <Card
                        variant="muted"
                        padding="default"
                        role="alert"
                        aria-live="assertive"
                    >
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.discovery.localError")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}
