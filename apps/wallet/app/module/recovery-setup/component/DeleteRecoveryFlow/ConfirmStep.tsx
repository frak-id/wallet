import { Button } from "@frak-labs/design-system/components/Button";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { generateDisableRecoveryData } from "@/module/recovery/action/generate";
import { useDeleteRecoveryBlob } from "@/module/recovery-setup/hook/useDeleteRecoveryBlob";
import { useRecoveryAuthorization } from "@/module/recovery-setup/hook/useRecoveryAuthorization";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";

type ConfirmStepProps = {
    onConfirmed: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function ConfirmStep({
    onConfirmed,
    onBack,
    stepIndicator,
}: ConfirmStepProps) {
    const { t } = useTranslation();
    const { setupRecoveryAsync, isPending: isDisabling } = useSetupRecovery();
    const { deleteRecoveryBlobAsync, isPending: isDeleting } =
        useDeleteRecoveryBlob();
    const { error, authorize } = useRecoveryAuthorization();

    const isPending = isDisabling || isDeleting;

    const handleConfirm = useCallback(async () => {
        const result = await authorize(async () => {
            // Disable on-chain first (the security-critical step), then drop the
            // now-useless backend blob.
            const { setupTxData } = await generateDisableRecoveryData();
            await setupRecoveryAsync({ setupTxData });
            await deleteRecoveryBlobAsync();
        });
        if (result.ok) onConfirmed();
    }, [authorize, setupRecoveryAsync, deleteRecoveryBlobAsync, onConfirmed]);

    const description = error
        ? t(`wallet.recoverySetup.delete.confirm.${error}Description`)
        : t("wallet.recoverySetup.delete.confirm.description");

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.delete.confirm.title")}
            description={description}
            onBack={onBack}
            backDisabled={isPending}
            stepIndicator={stepIndicator}
            footer={
                <Button
                    type="button"
                    variant="destructive"
                    size="large"
                    width="full"
                    onClick={handleConfirm}
                    loading={isPending}
                    disabled={isPending}
                >
                    {error
                        ? t("wallet.recoverySetup.delete.confirm.retry")
                        : t("wallet.recoverySetup.delete.confirm.authorise")}
                </Button>
            }
        >
            <WarningCard>
                {error
                    ? t(`wallet.recoverySetup.delete.confirm.${error}`)
                    : t("wallet.recoverySetup.delete.confirm.warning")}
            </WarningCard>
        </FlowStepScreen>
    );
}
