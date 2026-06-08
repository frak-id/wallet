import { Button } from "@frak-labs/design-system/components/Button";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { EmailFlowResultScreen } from "@/module/common/component/EmailFlowResultScreen";
import { StepIndicator } from "@/module/common/component/StepIndicator";
import { ConfirmStep } from "./ConfirmStep";
import { PasswordStep } from "./PasswordStep";

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
            <PasswordStep
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
