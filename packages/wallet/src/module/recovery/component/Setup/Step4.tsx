import { AccordionRecoveryItem } from "@/module/recovery/component/AccordionItem";
import { getStatusCurrentStep } from "@/module/recovery/component/Setup";
import { useSetupRecovery } from "@/module/recovery/hook/useSetupRecovery";
import {
    recoveryOptionsAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom, useAtomValue } from "jotai";
import { useEffect } from "react";
import { useChainId } from "wagmi";

const ACTUAL_STEP = 4;

export function Step4() {
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);

    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Get the chain ID
    const chainId = useChainId();

    // Setup recovery
    const { setupRecoveryAsync, isPending, isSuccess, isError, error } =
        useSetupRecovery({
            chainId,
        });

    /**
     * Run when the step is 4
     */
    useEffect(() => {
        if (step !== ACTUAL_STEP) return;

        async function runStep() {
            if (!recoveryOptions) return;
            const txHash = await setupRecoveryAsync({
                setupTxData: recoveryOptions.setupTxData,
            });
            console.log("Tx hash", txHash);
        }
        runStep();
    }, [step, recoveryOptions, setupRecoveryAsync]);

    /**
     * Run when the transaction is successful
     */
    useEffect(() => {
        if (!isSuccess) return;
        setStep(ACTUAL_STEP + 1);
    }, [isSuccess, setStep]);

    return (
        <AccordionRecoveryItem
            item={`step-${ACTUAL_STEP}`}
            trigger={<span>{ACTUAL_STEP}. Enable recovery on-chain</span>}
            status={getStatusCurrentStep(ACTUAL_STEP, step)}
        >
            {isPending && (
                <p>
                    Transaction in progress
                    <span className={"dotsLoading"}>...</span>
                </p>
            )}
            {isError && (
                <p className={"error"}>Transaction error: {error?.message}</p>
            )}
        </AccordionRecoveryItem>
    );
}
