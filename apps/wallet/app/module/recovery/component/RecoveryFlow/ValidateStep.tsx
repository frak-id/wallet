import { Button } from "@frak-labs/design-system/components/Button";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { type ReactNode, useCallback } from "react";
import { useTranslation } from "react-i18next";
import type { Address, LocalAccount } from "viem";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { FlowStepScreen } from "@/module/common/component/FlowStepScreen";
import { WarningCard } from "@/module/common/component/WarningCard";
import { useDateFormatter } from "@/module/common/hook/useDateFormatter";
import { useCurrentRecoveryOption } from "@/module/recovery/hook/useCurrentRecoveryOption";
import { useRunRecovery } from "@/module/recovery/hook/useRunRecovery";
import {
    evaluateRecoveryReadiness,
    type RecoveryReadiness,
} from "@/module/recovery/utils/recoveryReadiness";
import { SummaryRow } from "@/module/recovery-setup/component/SummaryRow";
import { useRecoveryAuthorization } from "@/module/recovery-setup/hook/useRecoveryAuthorization";

type ValidateStepProps = {
    walletAddress: Address;
    guardianAccount: LocalAccount<string>;
    onRecovered: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
};

export function ValidateStep({
    walletAddress,
    guardianAccount,
    onRecovered,
    onBack,
    stepIndicator,
}: ValidateStepProps) {
    const { t } = useTranslation();
    const { data: recovery, isLoading } =
        useCurrentRecoveryOption(walletAddress);

    if (isLoading || recovery === undefined) {
        return (
            <FlowStepScreen
                title={t("wallet.recoveryUsage.validate.loadingTitle")}
                description={t(
                    "wallet.recoveryUsage.validate.loadingDescription"
                )}
                onBack={onBack}
                stepIndicator={stepIndicator}
            />
        );
    }

    const readiness = evaluateRecoveryReadiness({
        recovery,
        guardianAddress: guardianAccount.address,
    });

    if (readiness.kind !== "ready") {
        return (
            <BlockedScreen
                readiness={readiness}
                onBack={onBack}
                stepIndicator={stepIndicator}
            />
        );
    }

    return (
        <ReadyScreen
            walletAddress={walletAddress}
            guardianAccount={guardianAccount}
            validUntil={readiness.validUntil}
            onRecovered={onRecovered}
            onBack={onBack}
            stepIndicator={stepIndicator}
        />
    );
}

function ReadyScreen({
    walletAddress,
    guardianAccount,
    validUntil,
    onRecovered,
    onBack,
    stepIndicator,
}: {
    walletAddress: Address;
    guardianAccount: LocalAccount<string>;
    validUntil: number;
    onRecovered: () => void;
    onBack: () => void;
    stepIndicator?: ReactNode;
}) {
    const { t } = useTranslation();
    const formatter = useDateFormatter();
    const { runRecoveryAsync, isPending } = useRunRecovery();
    const { error, authorize } = useRecoveryAuthorization();

    const handleRecover = useCallback(async () => {
        const result = await authorize(() =>
            runRecoveryAsync({ walletAddress, guardianAccount })
        );
        if (result.ok) onRecovered();
    }, [
        authorize,
        runRecoveryAsync,
        walletAddress,
        guardianAccount,
        onRecovered,
    ]);

    const description = error
        ? t(`wallet.recoveryUsage.validate.${error}Description`)
        : t("wallet.recoveryUsage.validate.description");

    return (
        <FlowStepScreen
            title={t("wallet.recoveryUsage.validate.title")}
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
                    loading={isPending}
                    disabled={isPending}
                    onClick={handleRecover}
                >
                    {error
                        ? t("wallet.recoveryUsage.validate.retry")
                        : t("wallet.recoveryUsage.validate.authorise")}
                </Button>
            }
        >
            <Stack space="s">
                <SummaryRow
                    label={t("wallet.recoveryUsage.validate.walletLabel")}
                    value={shortenAddress(walletAddress)}
                />
                <SummaryRow
                    label={t("wallet.recoveryUsage.validate.expiresLabel")}
                    value={
                        validUntil
                            ? formatter.format(new Date(validUntil * 1000))
                            : t("wallet.recoveryUsage.validate.never")
                    }
                />
            </Stack>

            {error ? (
                <WarningCard>
                    {t(`wallet.recoveryUsage.validate.${error}`)}
                </WarningCard>
            ) : null}
        </FlowStepScreen>
    );
}

function BlockedScreen({
    readiness,
    onBack,
    stepIndicator,
}: {
    readiness: Exclude<RecoveryReadiness, { kind: "ready" }>;
    onBack: () => void;
    stepIndicator?: ReactNode;
}) {
    const { t } = useTranslation();
    const formatter = useDateFormatter();
    const date =
        readiness.kind === "tooEarly"
            ? formatter.format(new Date(readiness.validAfter * 1000))
            : readiness.kind === "expired"
              ? formatter.format(new Date(readiness.validUntil * 1000))
              : "";

    return (
        <EmailFlowResultScreen
            title={t(`wallet.recoveryUsage.validate.${readiness.kind}.title`)}
            description={t(
                `wallet.recoveryUsage.validate.${readiness.kind}.description`,
                { date }
            )}
            onBack={onBack}
            headerCenter={stepIndicator}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onBack}
            >
                {t("wallet.recoveryUsage.validate.tryAnother")}
            </Button>
        </EmailFlowResultScreen>
    );
}

function shortenAddress(address: Address): string {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
}
