import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { CheckIcon } from "@frak-labs/design-system/icons";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { StepIndicator } from "@/module/common/component/StepIndicator";
import { RecoveryPasswordGate } from "@/module/recovery-setup/component/RecoveryPasswordGate";
import { ConfirmStep } from "./ConfirmStep";

type Step = { kind: "password" } | { kind: "confirm" } | { kind: "success" };

const STEP_TOTAL = 2;
const STEP_NUMBER: Record<Exclude<Step["kind"], "success">, number> = {
    password: 1,
    confirm: 2,
};

type DeleteRecoveryFlowProps = {
    /** Leave before completion (back to the configuration screen). */
    onAbort: () => void;
    /** Recovery removed on-chain and on the backend — navigates to the profile. */
    onCompleted: () => void;
};

/**
 * Turn recovery off entirely: confirm the password (a deliberate safety gate),
 * then disable the on-chain executor and delete the backend blob in one
 * authorized step.
 */
export function DeleteRecoveryFlow({
    onAbort,
    onCompleted,
}: DeleteRecoveryFlowProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>({ kind: "password" });

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
                title={t("wallet.recoverySetup.delete.password.title")}
                description={t(
                    "wallet.recoverySetup.delete.password.description"
                )}
                placeholder={t(
                    "wallet.recoverySetup.delete.password.placeholder"
                )}
                continueLabel={t(
                    "wallet.recoverySetup.delete.password.continue"
                )}
                invalidMessage={t(
                    "wallet.recoverySetup.delete.password.invalid"
                )}
                onVerified={() => setStep({ kind: "confirm" })}
                onBack={onAbort}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "confirm") {
        return (
            <ConfirmStep
                onConfirmed={() => setStep({ kind: "success" })}
                onBack={() => setStep({ kind: "password" })}
                stepIndicator={stepIndicator}
            />
        );
    }

    return (
        <EmailFlowResultScreen
            icon={
                <IconCircle size="lg" tone="action">
                    <CheckIcon width={28} height={28} />
                </IconCircle>
            }
            title={t("wallet.recoverySetup.delete.success.title")}
            description={t("wallet.recoverySetup.delete.success.description")}
        >
            <Button
                type="button"
                variant="primary"
                size="large"
                width="full"
                onClick={onCompleted}
            >
                {t("wallet.recoverySetup.delete.success.done")}
            </Button>
        </EmailFlowResultScreen>
    );
}
