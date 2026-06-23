import { useState } from "react";
import { StepIndicator } from "@/module/common/component/StepIndicator";
import { BackupStep } from "./BackupStep";
import { PasswordStep } from "./PasswordStep";
import { SignStep } from "./SignStep";
import { SuccessStep } from "./SuccessStep";

/**
 * `setup` mints the first recovery key; `refresh` mints a fresh burner that
 * replaces the existing one (same pipeline, a few different wordings).
 */
export type RecoveryFlowMode = "setup" | "refresh";

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
    /** `setup` (default) for first-time setup, `refresh` to replace an existing key. */
    mode?: RecoveryFlowMode;
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
    mode = "setup",
    onAbort,
    onCompleted,
}: RecoverySetupFlowProps) {
    const [step, setStep] = useState<Step>({ kind: "password" });

    const stepIndicator =
        step.kind === "success" ? null : (
            <StepIndicator
                current={RECOVERY_STEP_NUMBER[step.kind]}
                total={RECOVERY_STEP_TOTAL}
                translationKey="wallet.recoverySetup.stepIndicator"
            />
        );

    if (step.kind === "password") {
        return (
            <PasswordStep
                mode={mode}
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
                mode={mode}
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

    return <SuccessStep mode={mode} onDone={onCompleted} />;
}
