import { Box } from "@frak-labs/design-system/components/Box";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Check, Copy, Eye, EyeOff } from "lucide-react";
import { tryit } from "radash";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useSaveRecoveryBlob } from "@/module/recovery-setup/hook/useSaveRecoveryBlob";
import * as styles from "./styles.css";

type BackupStepProps = {
    blob: string;
    onDone: () => void;
    stepIndicator?: ReactNode;
};

export function BackupStep({ blob, onDone, stepIndicator }: BackupStepProps) {
    const { t } = useTranslation();
    const { saveRecoveryBlobAsync, isPending, isError } = useSaveRecoveryBlob();
    const [saved, setSaved] = useState(false);
    const [revealed, setRevealed] = useState(false);
    const [copied, setCopied] = useState(false);

    // Persist the encrypted blob to the backend. The user can only leave this
    // step once it lands (or via the explicit retry below), so the success
    // screen never lies about the backup being stored server-side.
    const save = useCallback(async () => {
        const [error] = await tryit(saveRecoveryBlobAsync)({ blob });
        if (!error) setSaved(true);
    }, [blob, saveRecoveryBlobAsync]);

    useEffect(() => {
        save();
    }, [save]);

    const handleCopy = async () => {
        const [error] = await tryit(() =>
            navigator.clipboard.writeText(blob)
        )();
        if (error) return;
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const masked = "•".repeat(blob.length);
    const saveFailed = isError && !saved;

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.backup.title")}
            description={t("wallet.recoverySetup.backup.description")}
            stepIndicator={stepIndicator}
            footer={
                <Stack space="s">
                    <Button
                        type="button"
                        variant="primary"
                        size="large"
                        width="full"
                        onClick={onDone}
                        disabled={!saved}
                        loading={isPending}
                    >
                        {t("wallet.recoverySetup.backup.continue")}
                    </Button>
                    {saveFailed ? (
                        <Button
                            type="button"
                            variant="secondary"
                            size="large"
                            width="full"
                            onClick={save}
                            loading={isPending}
                        >
                            {t("wallet.recoverySetup.backup.retry")}
                        </Button>
                    ) : null}
                </Stack>
            }
        >
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

            <WarningCard>
                {t("wallet.recoverySetup.backup.warning")}
            </WarningCard>

            {saveFailed ? (
                <WarningCard>
                    {t("wallet.recoverySetup.backup.saveError")}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}
