import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { tryit } from "radash";
import { type ReactNode, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { PageLayout } from "@/module/common/component/PageLayout";
import { Title } from "@/module/common/component/Title";
import { useSaveRecoveryBlob } from "@/module/recovery-setup/hook/useSaveRecoveryBlob";
import * as styles from "./styles.css";

type BackupStepProps = {
    blob: string;
    onDone: () => void;
    stepIndicator?: ReactNode;
};

export function BackupStep({ blob, onDone, stepIndicator }: BackupStepProps) {
    const { t } = useTranslation();
    const { saveRecoveryBlob, isError } = useSaveRecoveryBlob();
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        saveRecoveryBlob({ blob });
    }, [blob, saveRecoveryBlob]);

    const handleCopy = async () => {
        const [error] = await tryit(() =>
            navigator.clipboard.writeText(blob)
        )();
        if (error) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const masked = "•".repeat(blob.length);

    return (
        <PageLayout
            headerCenter={stepIndicator}
            footer={
                <Box className={styles.footer}>
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onDone}
                    >
                        {t("wallet.recoverySetup.backup.continue")}
                    </Button>
                </Box>
            }
        >
            <Stack space="l" className={styles.body}>
                <Stack space="s">
                    <Title size="page">
                        {t("wallet.recoverySetup.backup.title")}
                    </Title>
                    <Text variant="body" color="secondary">
                        {t("wallet.recoverySetup.backup.description")}
                    </Text>
                </Stack>

                <Card variant="muted" padding="default">
                    <Stack space="s">
                        <Text variant="bodySmall" className={styles.blob}>
                            {revealed ? blob : masked}
                        </Text>
                        <Box className={styles.blobActions}>
                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                width="auto"
                                onClick={() => setRevealed((prev) => !prev)}
                                icon={
                                    revealed ? (
                                        <EyeOff size={16} />
                                    ) : (
                                        <Eye size={16} />
                                    )
                                }
                            >
                                {revealed
                                    ? t("wallet.recoverySetup.backup.hide")
                                    : t("wallet.recoverySetup.backup.reveal")}
                            </Button>
                            <Button
                                type="button"
                                variant="secondary"
                                size="small"
                                width="auto"
                                onClick={handleCopy}
                                icon={
                                    copied ? (
                                        <Check size={16} />
                                    ) : (
                                        <Copy size={16} />
                                    )
                                }
                            >
                                {copied
                                    ? t("wallet.recoverySetup.backup.copied")
                                    : t("wallet.recoverySetup.backup.copy")}
                            </Button>
                        </Box>
                    </Stack>
                </Card>

                <Card variant="muted" padding="default">
                    <Text variant="bodySmall" color="error">
                        {t("wallet.recoverySetup.backup.warning")}
                    </Text>
                </Card>

                {isError && (
                    <Text variant="bodySmall" color="error">
                        {t("wallet.recoverySetup.backup.saveError")}
                    </Text>
                )}
            </Stack>
        </PageLayout>
    );
}
