import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Spinner } from "@frak-labs/design-system/components/Spinner";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { PairingQrCode, PairingStatus } from "@frak-labs/wallet-shared";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import type { MergeStrategy } from "../../strategy/types";
import * as styles from "../stepLayout.css";

export type RemotePairingPanelI18nKeys = {
    title: string;
    description: string;
    preparing: string;
    error: string;
    retry: string;
};

type RemotePairingPanelProps = {
    strategy: MergeStrategy;
    isError: boolean;
    onRetry: () => void;
    onBack: () => void;
    i18nKeys: RemotePairingPanelI18nKeys;
};

/**
 * Shared scaffold for any merge step waiting on the paired peer (consent
 * sign-off, distant-webauthn switch). Owns the QR + status presentation +
 * retry button so callers only supply their step-specific copy.
 */
export function RemotePairingPanel({
    strategy,
    isError,
    onRetry,
    onBack,
    i18nKeys,
}: RemotePairingPanelProps) {
    const { t } = useTranslation();
    const pairingInfo = strategy.remote?.pairingState.pairing;
    const status = strategy.remote?.pairingState.status ?? "idle";

    return (
        <PageLayout
            back={<Back onClick={onBack} />}
            footer={
                isError ? (
                    <Box className={styles.footer}>
                        <Button
                            type="button"
                            variant="primary"
                            size="large"
                            width="full"
                            onClick={onRetry}
                        >
                            {t(i18nKeys.retry)}
                        </Button>
                    </Box>
                ) : undefined
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">{t(i18nKeys.title)}</Title>
                    <Text variant="body" color="secondary">
                        {t(i18nKeys.description)}
                    </Text>
                </Stack>

                {pairingInfo ? (
                    <Stack space="m" align="center">
                        <PairingQrCode
                            value={`${process.env.FRAK_WALLET_URL ?? ""}/p/${pairingInfo.id}`}
                            size={200}
                            errorCorrection="quartile"
                        />
                        <PairingStatus status={status} />
                    </Stack>
                ) : (
                    <Stack space="m" align="center">
                        <Spinner />
                        <Text variant="bodySmall" color="secondary">
                            {t(i18nKeys.preparing)}
                        </Text>
                    </Stack>
                )}

                {isError && (
                    <Card variant="muted" padding="default">
                        <Text variant="bodySmall" color="error">
                            {t(i18nKeys.error)}
                        </Text>
                    </Card>
                )}
            </Stack>
        </PageLayout>
    );
}
