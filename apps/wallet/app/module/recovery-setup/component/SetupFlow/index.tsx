import { Text } from "@frak-labs/design-system/components/Text";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { BackupStep } from "./BackupStep";
import { PasswordStep } from "./PasswordStep";
import { SignStep } from "./SignStep";
import { SuccessStep } from "./SuccessStep";

type Step =
    | { kind: "password" }
    | { kind: "sign"; password: string; validAfter: number; validUntil: number }
    | { kind: "backup"; blob: string }
    | { kind: "success" };

const RECOVERY_STEP_TOTAL = 4;
const RECOVERY_STEP_NUMBER: Record<Exclude<Step["kind"], "success">, number> = {
    password: 1,
    sign: 2,
    backup: 3,
};

type RecoverySetupFlowProps = {
    /** Leave the flow before completion (back to the recovery landing). */
    onAbort: () => void;
    /** Recovery is set up and backed up — typically navigates to the profile. */
    onCompleted: () => void;
};

/**
 * Multi-step recovery setup, mirroring the wallet-merge flow: each step is a
 * self-contained screen, state is local, and the burner key produced in `sign`
 * is carried forward only as the encrypted blob.
 */
export function RecoverySetupFlow({
    onAbort,
    onCompleted,
}: RecoverySetupFlowProps) {
    const { t } = useTranslation();
    const [step, setStep] = useState<Step>({ kind: "password" });

    const stepIndicator = renderStepIndicator(t, step.kind);

    if (step.kind === "password") {
        return (
            <PasswordStep
                onSubmit={({ password, validAfter, validUntil }) =>
                    setStep({ kind: "sign", password, validAfter, validUntil })
                }
                onBack={onAbort}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "sign") {
        return (
            <SignStep
                password={step.password}
                validAfter={step.validAfter}
                validUntil={step.validUntil}
                onSigned={(blob) => setStep({ kind: "backup", blob })}
                onBack={() => setStep({ kind: "password" })}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "backup") {
        return (
            <BackupStep
                blob={step.blob}
                onDone={() => setStep({ kind: "success" })}
                stepIndicator={stepIndicator}
            />
        );
    }

    return <SuccessStep onDone={onCompleted} />;
}

function renderStepIndicator(
    t: ReturnType<typeof useTranslation>["t"],
    kind: Step["kind"]
): ReactNode {
    if (kind === "success") return null;
    return (
        <Text variant="bodySmall" color="secondary">
            {t("wallet.recoverySetup.stepIndicator", {
                current: RECOVERY_STEP_NUMBER[kind],
                total: RECOVERY_STEP_TOTAL,
            })}
        </Text>
    );
}
