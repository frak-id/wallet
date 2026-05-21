import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useLoserConsent } from "../../hook/useLoserConsent";
import * as styles from "./index.css";

type ConsentStepProps = {
    winner: Address;
    loserAuthenticatorId: string;
    /** Called with the base64 signature once the user confirms locally. */
    onConfirmed: (loserConsentSignature: string) => void;
    onBack: () => void;
};

/**
 * Single-purpose step that asks the user to confirm on the *loser* passkey:
 *
 *  - It's the only place a same-device merge cannot bypass: the loser side
 *    must produce a cryptographic consent over a backend-deterministic
 *    challenge before settle accepts the merge.
 *  - It doubles as the local-availability probe — if the OS doesn't surface
 *    the loser credential on this device, the `navigator.credentials.get`
 *    prompt fails and we can fall back to the "use your other device"
 *    placeholder (Phase 2 closes this gap with cross-device pairing).
 *
 * Failure surface: any biometric cancel or "no credential available" lands
 * here as a retryable error. The mutation's `gcTime: 0` means each retry
 * is a fresh prompt, no stale signature is ever reused.
 */
export function ConsentStep({
    winner,
    loserAuthenticatorId,
    onConfirmed,
    onBack,
}: ConsentStepProps) {
    const { t } = useTranslation();
    const consent = useLoserConsent();

    const onVerify = useCallback(() => {
        consent.mutate(
            { winner, loserAuthenticatorId },
            {
                onSuccess: ({ loserConsentSignature }) => {
                    onConfirmed(loserConsentSignature);
                },
            }
        );
    }, [consent, winner, loserAuthenticatorId, onConfirmed]);

    return (
        <PageLayout
            back={<Back onClick={onBack} />}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onVerify}
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
