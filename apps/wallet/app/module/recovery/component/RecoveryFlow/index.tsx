import { useNavigate } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import type { Address, LocalAccount } from "viem";
import { StepIndicator } from "@/module/common/component/StepIndicator";
import { isRecoveryBlobEnvelope } from "@/module/recovery-setup/utils/recoveryBlob";
import { BlobStep } from "./BlobStep";
import { PasswordStep } from "./PasswordStep";
import { SuccessStep } from "./SuccessStep";
import { ValidateStep } from "./ValidateStep";

type Step =
    | { kind: "blob" }
    | { kind: "password"; blob: string }
    | {
          kind: "recover";
          blob: string;
          walletAddress: Address;
          guardianAccount: LocalAccount<string>;
      }
    | { kind: "success" };

const RECOVERY_STEP_TOTAL = 3;
const RECOVERY_STEP_NUMBER: Record<Exclude<Step["kind"], "success">, number> = {
    blob: 1,
    password: 2,
    recover: 3,
};

type RecoveryUsageFlowProps = {
    /** Blob pulled from the URL hash, when the user opened a recovery link. */
    initialBlob?: string;
};

/**
 * Multi-step wallet recovery, mirroring the recovery-setup flow: each step is a
 * self-contained screen and state is local. The guardian account derived from
 * the backup is carried forward only as far as the on-chain push that uses it.
 */
export function RecoveryUsageFlow({ initialBlob }: RecoveryUsageFlowProps) {
    const navigate = useNavigate();
    // A malformed `#blob=` link otherwise lands straight on the password step
    // and fails to decode; only skip ahead when it's actually a recovery envelope.
    const linkBlob = useMemo(
        () =>
            initialBlob && isRecoveryBlobEnvelope(initialBlob)
                ? initialBlob
                : undefined,
        [initialBlob]
    );
    const [step, setStep] = useState<Step>(
        linkBlob ? { kind: "password", blob: linkBlob } : { kind: "blob" }
    );

    const leaveToLogin = () => navigate({ to: "/login" });
    const stepIndicator =
        step.kind === "success" ? null : (
            <StepIndicator
                current={RECOVERY_STEP_NUMBER[step.kind]}
                total={RECOVERY_STEP_TOTAL}
                translationKey="wallet.recoveryUsage.stepIndicator"
            />
        );

    if (step.kind === "blob") {
        return (
            <BlobStep
                onSubmit={(blob) => setStep({ kind: "password", blob })}
                onBack={leaveToLogin}
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "password") {
        return (
            <PasswordStep
                blob={step.blob}
                onUnlocked={(walletAddress, guardianAccount) =>
                    setStep({
                        kind: "recover",
                        blob: step.blob,
                        walletAddress,
                        guardianAccount,
                    })
                }
                onBack={
                    linkBlob ? leaveToLogin : () => setStep({ kind: "blob" })
                }
                stepIndicator={stepIndicator}
            />
        );
    }

    if (step.kind === "recover") {
        return (
            <ValidateStep
                walletAddress={step.walletAddress}
                guardianAccount={step.guardianAccount}
                onRecovered={() => setStep({ kind: "success" })}
                onBack={() => setStep({ kind: "password", blob: step.blob })}
                stepIndicator={stepIndicator}
            />
        );
    }

    return <SuccessStep onDone={() => navigate({ to: "/wallet" })} />;
}
