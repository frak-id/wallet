import { Button } from "@frak-labs/design-system/components/Button";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useConnection } from "wagmi";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { generateDisableRecoveryData } from "@/module/recovery/action/generate";
import { getCurrentRecoveryOption } from "@/module/recovery/action/get";
import { useDeleteRecoveryBlob } from "@/module/recovery-setup/hook/useDeleteRecoveryBlob";
import { useRecoveryAuthorization } from "@/module/recovery-setup/hook/useRecoveryAuthorization";
import { useSendRecoveryTx } from "@/module/recovery-setup/hook/useSendRecoveryTx";

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
    const { address } = useConnection();
    const { sendRecoveryTxAsync, isPending: isDisabling } = useSendRecoveryTx();
    const { deleteRecoveryBlobAsync, isPending: isDeleting } =
        useDeleteRecoveryBlob();
    const { error, authorize } = useRecoveryAuthorization();

    const isPending = isDisabling || isDeleting;

    const handleConfirm = useCallback(async () => {
        const result = await authorize(async () => {
            // Disable on-chain first (the security-critical step), then drop
            // the now-useless backend blob. A retry after a failed blob delete
            // reads the chain and skips the already-landed disable tx instead
            // of re-sending it.
            const stillEnabled =
                !!address &&
                !!(await getCurrentRecoveryOption({ wallet: address }));
            if (stillEnabled) {
                const { setupTxData } = await generateDisableRecoveryData();
                await sendRecoveryTxAsync({ setupTxData });
            }
            await deleteRecoveryBlobAsync();
        });
        if (result.ok) onConfirmed();
    }, [
        address,
        authorize,
        sendRecoveryTxAsync,
        deleteRecoveryBlobAsync,
        onConfirmed,
    ]);

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
