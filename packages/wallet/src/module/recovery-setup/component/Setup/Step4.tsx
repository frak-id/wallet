import { AccordionRecoveryItem } from "@/module/recovery-setup/component/AccordionItem";
import { getStatusCurrentStep } from "@/module/recovery-setup/component/Setup";
import { ButtonSetupChain } from "@/module/recovery-setup/component/Setup/ButtonSetupChain";
import {
    recoveryDoneStepAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom } from "jotai";
import { useAtomValue } from "jotai/index";
import { useEffect } from "react";
import { useConfig } from "wagmi";
import styles from "./Step4.module.css";

const ACTUAL_STEP = 4;

export function Step4() {
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);

    // Get the done steps
    const doneSteps = useAtomValue(recoveryDoneStepAtom);

    const { chains } = useConfig();

    useEffect(() => {
        if (doneSteps === chains.length) {
            setStep(ACTUAL_STEP + 1);
        }
    }, [doneSteps, setStep, chains.length]);

    return (
        <AccordionRecoveryItem
            item={`step-${ACTUAL_STEP}`}
            trigger={<span>{ACTUAL_STEP}. Enable recovery on-chain</span>}
            status={getStatusCurrentStep(ACTUAL_STEP, step)}
        >
            {chains.map((chain) => (
                <ButtonSetupChain
                    key={chain.id}
                    chain={chain}
                    className={styles.step4__button}
                />
            ))}
        </AccordionRecoveryItem>
    );
}
