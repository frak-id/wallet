import { Button } from "@frak-labs/design-system/components/Button";
import { selectWebauthnSession, sessionStore } from "@frak-labs/wallet-shared";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useGenerateRecoveryOptions } from "@/module/recovery-setup/hook/useGenerateRecoveryOptions";
import { useRecoveryAuthorization } from "@/module/recovery-setup/hook/useRecoveryAuthorization";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";
import type { RecoveryFlowMode } from "./index";

type SignStepProps = {
    mode: RecoveryFlowMode;
    password: string;
    validAfter: number;
    validUntil: number;
    /** Called with the encrypted backup blob once the on-chain tx lands. */
    onSigned: (blob: string) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function SignStep({
    mode,
    password,
    validAfter,
    validUntil,
    onSigned,
    onBack,
    stepIndicator,
}: SignStepProps) {
    const { t } = useTranslation();
    const session = useStore(sessionStore, selectWebauthnSession);
    const { generateRecoveryOptionsAsync, isPending: isGenerating } =
        useGenerateRecoveryOptions();
    const { setupRecoveryAsync, isPending: isSettingUp } = useSetupRecovery();
    const { error, authorize } = useRecoveryAuthorization();

    const isPending = isGenerating || isSettingUp;

    const handleConfirm = useCallback(async () => {
        if (!session) return;

        const result = await authorize(async () => {
            const { setupTxData, blob } = await generateRecoveryOptionsAsync({
                wallet: session,
                password,
                validAfter,
                validUntil,
            });
            await setupRecoveryAsync({ setupTxData });
            return blob;
        });

        if (result.ok) onSigned(result.value);
    }, [
        session,
        password,
        validAfter,
        validUntil,
        authorize,
        generateRecoveryOptionsAsync,
        setupRecoveryAsync,
        onSigned,
    ]);

    const defaultDescription =
        mode === "refresh"
            ? t("wallet.recoverySetup.refresh.signDescription")
            : t("wallet.recoverySetup.sign.description");
    const description = error
        ? t(`wallet.recoverySetup.sign.${error}Description`)
        : defaultDescription;

    return (
        <FlowStepScreen
            title={t("wallet.recoverySetup.sign.title")}
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
                        ? t("wallet.recoverySetup.sign.retry")
                        : t("wallet.recoverySetup.sign.authorise")}
                </Button>
            }
        >
            {error ? (
                <WarningCard>
                    {t(`wallet.recoverySetup.sign.${error}`)}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}
