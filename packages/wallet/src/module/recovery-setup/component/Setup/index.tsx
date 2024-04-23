"use client";

import { Accordion } from "@/module/common/component/Accordion";
import { Step1 } from "@/module/recovery-setup/component/Setup/Step1";
import { Step2 } from "@/module/recovery-setup/component/Setup/Step2";
import { Step3 } from "@/module/recovery-setup/component/Setup/Step3";
import { Step4 } from "@/module/recovery-setup/component/Setup/Step4";
import {
    recoveryDoneStepAtom,
    recoveryOptionsAtom,
    recoveryPasswordAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom, useSetAtom } from "jotai";
import { TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./index.module.css";

const MAX_STEPS = 5;

export function SetupRecovery() {
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);
    const setDoneStep = useSetAtom(recoveryDoneStepAtom);
    const setPasswordAtom = useSetAtom(recoveryPasswordAtom);
    const setOptionsAtom = useSetAtom(recoveryOptionsAtom);

    // Current step
    const [item, setItem] = useState<string>(`step-${step}`);

    useEffect(() => {
        setItem(`step-${step}`);
    }, [step]);

    useEffect(() => {
        return () => {
            // Reset the steps when leaving the component
            if (step !== MAX_STEPS) return;
            setStep(1);
            setDoneStep(0);
            setPasswordAtom(undefined);
            setOptionsAtom(undefined);
        };
    }, [step, setStep, setDoneStep, setPasswordAtom, setOptionsAtom]);

    return (
        <>
            <p className={styles.setupRecovery__disclaimer}>
                <TriangleAlert /> Warning
                <br />- We do not store any information related to your wallet
                recovery.
                <br />- You are solely responsible for keeping your recovery
                file and password secure and private.
                <br />- The recovery file can be generated now, but the actual
                recovery process will only be available one week after the file
                is created to prevent malicious usage.
            </p>
            <Accordion
                type={"single"}
                collapsible
                value={item}
                onValueChange={(value) => setItem(value)}
            >
                <Step1 />
                <Step2 />
                <Step3 />
                <Step4 />
            </Accordion>
        </>
    );
}

export function getStatusCurrentStep(step: number, currentStep: number) {
    if (step === currentStep) {
        return "in-progress";
    }
    if (step < currentStep) {
        return "done";
    }
    return "pending";
}
