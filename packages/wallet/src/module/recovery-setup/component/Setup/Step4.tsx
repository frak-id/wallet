import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { ButtonSetupChain } from "@/module/recovery-setup/component/Setup/ButtonSetupChain";
import {
    recoveryDoneStepAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useConfig } from "wagmi";
import styles from "./Step4.module.css";

const ACTUAL_STEP = 4;

export function Step4() {
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

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
            actualStep={ACTUAL_STEP}
            title={"Enable recovery on-chain"}
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
