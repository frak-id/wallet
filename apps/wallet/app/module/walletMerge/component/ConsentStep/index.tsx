import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useCallback, useEffect } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type { LoserConsentMutation, MergeStrategy } from "../../strategy/types";
import { RemotePairingPanel } from "../RemotePairingPanel";
import * as styles from "../stepLayout.css";

type ConsentStepProps = {
    winner: Address;
    loserAuthenticatorId: string;
    /** Called with the base64 signature once the consent has been signed. */
    onConfirmed: (loserConsentSignature: string) => void;
    onBack: () => void;
    /** Loser-consent mutation supplied by the active merge strategy. */
    consent: LoserConsentMutation;
    /** Active merge strategy — used to surface the pairing QR/status when
     *  this step needs to wait for a remote signer. */
    strategy: MergeStrategy;
    /**
     * `true` when the consent must come from the paired device (desktop is
     * the merge winner, loser passkey lives on mobile). The step kicks the
     * mutation off automatically on mount and renders the pair QR + status
     * while waiting for the mobile to scan + sign.
     */
    remoteConsent: boolean;
    /** Optional step indicator rendered in the header center (e.g. "3/5"). */
    stepIndicator?: ReactNode;
};

/**
 * Single-purpose step that gathers the loser's webauthn consent.
 *
 *  - Local consent (default): the user confirms on the *loser* passkey on
 *    this device. It's the only place a same-device merge cannot bypass:
 *    the loser side must produce a cryptographic consent over a backend-
 *    deterministic challenge before settle accepts the merge. Also doubles
 *    as the local-availability probe — if the OS doesn't surface the loser
 *    credential locally, the `navigator.credentials.get` prompt fails and
 *    we fall back to the "use your other device" path.
 *
 *  - Remote consent (cross-device merge, desktop is winner): the loser
 *    passkey lives on the paired mobile. The strategy mutation drives the
 *    pairing handshake and forwards the consent challenge as a
 *    `signatureKind: "raw-assertion"` signature-request, ultimately
 *    resolving with the same base64 assertion the local flow would
 *    produce. This step renders the QR + status banner while waiting; no
 *    biometric prompt is fired on this device.
 *
 * Failure surface: any biometric cancel or "no credential available"
 * lands here as a retryable error. The mutation's `gcTime: 0` means each
 * retry is a fresh prompt, no stale signature is ever reused.
 */
export function ConsentStep({
    winner,
    loserAuthenticatorId,
    onConfirmed,
    onBack,
    consent,
    strategy,
    remoteConsent,
    stepIndicator,
}: ConsentStepProps) {
    const { t } = useTranslation();

    const run = useCallback(() => {
        consent.mutateAsync(
            { winner, loserAuthenticatorId },
            {
                onSuccess: ({ loserConsentSignature }) =>
                    onConfirmed(loserConsentSignature),
            }
        );
    }, [consent.mutateAsync]);

    // Directly trigger a run on mount
    useEffect(() => {
        run();
    }, []);

    if (remoteConsent) {
        const peerIsPaired = strategy.remote?.pairingState.status === "paired";
        return (
            <RemoteConsentBody
                strategy={strategy}
                isError={consent.isError}
                onRetry={() => {
                    consent.reset();
                    strategy.remote?.onRetry();
                    run();
                }}
                onBack={onBack}
                stepIndicator={stepIndicator}
                showPeerWaiting={consent.isPending && peerIsPaired}
            />
        );
    }

    return (
        <PageLayout
            back={<Back onClick={onBack} />}
            headerCenter={stepIndicator}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={run}
                        loading={consent.isPending}
                        disabled={consent.isPending}
                    >
                        {consent.isError
                            ? t("wallet.merge.consent.retry")
                            : t("wallet.merge.consent.verify")}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t("wallet.merge.consent.title")}</Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.merge.consent.description")}
                    </Text>
                </Stack>

                <Card variant="muted" padding="default">
                    <Stack space="xs">
                        <Text variant="bodySmall" weight="semiBold">
                            {t("wallet.merge.consent.help.title")}
                        </Text>
                        <Text variant="bodySmall" color="secondary">
                            {t("wallet.merge.consent.help.description")}
                        </Text>
                    </Stack>
                </Card>

                {consent.isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t("wallet.merge.consent.error")}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}

function RemoteConsentBody(props: {
    strategy: MergeStrategy;
    isError: boolean;
    onRetry: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
    showPeerWaiting?: boolean;
}) {
    return (
        <RemotePairingPanel
            {...props}
            i18nKeys={{
                title: "wallet.merge.consent.remote.title",
                description: "wallet.merge.consent.remote.description",
                preparing: "wallet.merge.consent.remote.preparing",
                error: "wallet.merge.consent.remote.error",
                retry: "wallet.merge.consent.retry",
            }}
        />
    );
}
