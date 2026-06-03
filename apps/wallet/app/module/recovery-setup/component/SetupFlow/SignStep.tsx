import { Button } from "@frak-labs/design-system/components/Button";
import {
    isUserCancellation,
    selectWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { tryit } from "radash";
import { type ReactNode, useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
import { useStore } from "zustand";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useGenerateRecoveryOptions } from "@/module/recovery-setup/hook/useGenerateRecoveryOptions";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";

type SignError = "cancelled" | "failed";

type SignStepProps = {
    password: string;
    validAfter: number;
    validUntil: number;
    /** Called with the encrypted backup blob once the on-chain tx lands. */
    onSigned: (blob: string) => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function SignStep({
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
    const [error, setError] = useState<SignError | null>(null);

    const isPending = isGenerating || isSettingUp;

    const handleConfirm = useCallback(async () => {
        if (!session) return;
        setError(null);

        const [txError, blob] = await tryit(async () => {
            const { setupTxData, blob: generatedBlob } =
                await generateRecoveryOptionsAsync({
                    wallet: session,
                    password,
                    validAfter,
                    validUntil,
                });
            await setupRecoveryAsync({ setupTxData });
            return generatedBlob;
        })();

        if (txError || !blob) {
            setError(isUserCancellation(txError) ? "cancelled" : "failed");
            return;
        }
        onSigned(blob);
    }, [
        session,
        password,
        validAfter,
        validUntil,
        generateRecoveryOptionsAsync,
        setupRecoveryAsync,
        onSigned,
    ]);

    const description = error
        ? t(`wallet.recoverySetup.sign.${error}Description`)
        : t("wallet.recoverySetup.sign.description");

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
