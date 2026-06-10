import { Button } from "@frak-labs/design-system/components/Button";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { StepIndicator } from "@/module/common/component/StepIndicator";
import { RecoveryPasswordGate } from "@/module/recovery-setup/component/RecoveryPasswordGate";
import { useConnectedWalletRecovery } from "@/module/recovery-setup/hook/useConnectedWalletRecovery";
import { ConfirmStep } from "./ConfirmStep";
import { DatesStep } from "./DatesStep";

type Step =
    | { kind: "password" }
    | { kind: "dates" }
    | { kind: "confirm"; validAfter: number; validUntil: number }
    | { kind: "success" };

const STEP_TOTAL = 3;
const STEP_NUMBER: Record<Exclude<Step["kind"], "success">, number> = {
    password: 1,
    dates: 2,
    confirm: 3,
};

type RefreshDatesFlowProps = {
    /** Leave before completion (back to the configuration screen). */
    onAbort: () => void;
    /** Dates updated on-chain — typically navigates to the profile. */
    onCompleted: () => void;
    /** Switch to minting a fresh key (offered after a wrong password). */
    onReplaceKey: () => void;
};

/**
 * Keep-the-same-burner refresh: verify the password (the kept burner is only
 * useful if its blob still decrypts), pick new validity dates, then re-run the
 * on-chain `setExecution` with the existing guardian. No blob changes, so the
 * backend is never touched.
 */
export function RefreshDatesFlow({
    onAbort,
    onCompleted,
    onReplaceKey,
}: RefreshDatesFlowProps) {
    const { t } = useTranslation();
    const { onChainRecovery } = useConnectedWalletRecovery();
    const [step, setStep] = useState<Step>({ kind: "password" });

    // Only reachable when recovery is configured on-chain, so the guardian is
    // present; guard defensively in case the status query is still settling.
    const guardianAddress = onChainRecovery?.guardianAddress;

    const stepIndicator =
        step.kind === "success" ? null : (
            <StepIndicator
                current={STEP_NUMBER[step.kind]}
                total={STEP_TOTAL}
                translationKey="wallet.recoverySetup.stepIndicator"
            />
        );

    if (step.kind === "password") {
        return (
            <RecoveryPasswordGate
                title={t("wallet.recoverySetup.dates.password.title")}
                description={t(
                    "wallet.recoverySetup.dates.password.description"
                )}
                placeholder={t(
                    "wallet.recoverySetup.dates.password.placeholder"
                )}
                continueLabel={t(
                    "wallet.recoverySetup.dates.password.continue"
                )}
                invalidMessage={t(
                    "wallet.recoverySetup.dates.password.invalid"
                )}
                onVerified={() => setStep({ kind: "dates" })}
                onBack={onAbort}
                stepIndicator={stepIndicator}
                failureExtra={
                    <Button
                        type="button"
                        variant="secondary"
                        size="large"
                        width="full"
                        onClick={onReplaceKey}
                    >
                        {t("wallet.recoverySetup.dates.password.replaceAction")}
                    </Button>
                }
            />
        );
    }

    if (step.kind === "dates") {
        return (
            <DatesStep
                onSubmit={({ validAfter, validUntil }) =>
                    setStep({ kind: "confirm", validAfter, validUntil })
                }
                onBack={() => setStep({ kind: "password" })}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "confirm") {
        if (!guardianAddress) return null;
        return (
            <ConfirmStep
                guardianAddress={guardianAddress}
                validAfter={step.validAfter}
                validUntil={step.validUntil}
                onConfirmed={() => setStep({ kind: "success" })}
                onBack={() => setStep({ kind: "dates" })}
                stepIndicator={stepIndicator}
            />
        );
    }

    return (
        <EmailFlowResultScreen
            title={t("wallet.recoverySetup.dates.success.title")}
            description={t("wallet.recoverySetup.dates.success.description")}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onCompleted}
            >
                {t("wallet.recoverySetup.dates.success.done")}
            </Button>
        </EmailFlowResultScreen>
    );
}
