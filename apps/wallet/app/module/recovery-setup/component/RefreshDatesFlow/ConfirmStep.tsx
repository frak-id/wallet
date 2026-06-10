import { Badge } from "@frak-labs/design-system/components/Badge";
import { Button } from "@frak-labs/design-system/components/Button";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Address } from "viem";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useDateFormatter } from "@/module/common/hook/useDateFormatter";
import { generateRecoveryData } from "@/module/recovery/action/generate";
import { SummaryRow } from "@/module/recovery-setup/component/SummaryRow";
import { useRecoveryAuthorization } from "@/module/recovery-setup/hook/useRecoveryAuthorization";
import { useSendRecoveryTx } from "@/module/recovery-setup/hook/useSendRecoveryTx";

type ConfirmStepProps = {
    /** The existing on-chain guardian — reused unchanged, only the dates move. */
    guardianAddress: Address;
    validAfter: number;
    validUntil: number;
    onConfirmed: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function ConfirmStep({
    guardianAddress,
    validAfter,
    validUntil,
    onConfirmed,
    onBack,
    stepIndicator,
}: ConfirmStepProps) {
    const { t } = useTranslation();
    const { sendRecoveryTxAsync, isPending } = useSendRecoveryTx();
    const { error, authorize } = useRecoveryAuthorization();
    const formatter = useDateFormatter();

    const handleConfirm = useCallback(async () => {
        const result = await authorize(async () => {
            const { setupTxData } = await generateRecoveryData({
                guardianAddress,
                validAfter,
                validUntil,
            });
            await sendRecoveryTxAsync({ setupTxData });
        });
        if (result.ok) onConfirmed();
    }, [
        authorize,
        guardianAddress,
        validAfter,
        validUntil,
        sendRecoveryTxAsync,
        onConfirmed,
    ]);

    const description = error
        ? t(`wallet.recoverySetup.dates.confirm.${error}Description`)
        : t("wallet.recoverySetup.dates.confirm.description");

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.dates.confirm.title")}
            description={description}
            onBack={onBack}
            backDisabled={isPending}
            stepIndicator={stepIndicator}
            footer={
                <Button
                    type="button"
                    variant="primary"
                    size="large"
                    width="full"
                    onClick={handleConfirm}
                    loading={isPending}
                    disabled={isPending}
                >
                    {error
                        ? t("wallet.recoverySetup.dates.confirm.retry")
                        : t("wallet.recoverySetup.dates.confirm.authorise")}
                </Button>
            }
        >
            <Card variant="muted" padding="default">
                <Stack space="s">
                    <SummaryRow
                        label={t("wallet.recoverySetup.dates.confirm.keyLabel")}
                        value={
                            <Badge variant="success">
                                {t(
                                    "wallet.recoverySetup.dates.confirm.keyUnchanged"
                                )}
                            </Badge>
                        }
                    />
                    <SummaryRow
                        label={t("wallet.recoverySetup.config.startLabel")}
                        value={formatter.format(new Date(validAfter * 1000))}
                    />
                    <SummaryRow
                        label={t("wallet.recoverySetup.config.endLabel")}
                        value={
                            validUntil
                                ? formatter.format(new Date(validUntil * 1000))
                                : t("wallet.recoverySetup.config.never")
                        }
                    />
                </Stack>
            </Card>

            {error ? (
                <WarningCard>
                    {t(`wallet.recoverySetup.dates.confirm.${error}`)}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}
