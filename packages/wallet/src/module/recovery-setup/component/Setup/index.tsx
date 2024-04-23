"use client";

import { Accordion } from "@/module/common/component/Accordion";
import styles from "@/module/recovery-setup/component/AccordionItem/index.module.css";
import { Step1 } from "@/module/recovery-setup/component/Setup/Step1";
import { Step2 } from "@/module/recovery-setup/component/Setup/Step2";
import { Step3 } from "@/module/recovery-setup/component/Setup/Step3";
import { Step4 } from "@/module/recovery-setup/component/Setup/Step4";
import { recoveryStepAtom } from "@/module/settings/atoms/recovery";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";

export function SetupRecovery() {
    const step = useAtomValue(recoveryStepAtom);
    const [item, setItem] = useState<string>(`step-${step}`);

    useEffect(() => {
        setItem(`step-${step}`);
    }, [step]);

    return (
        <Accordion
            type={"single"}
            collapsible
            className={styles.accordion}
            value={item}
            onValueChange={(value) => setItem(value)}
        >
            <Step1 />
            <Step2 />
            <Step3 />
            <Step4 />
        </Accordion>
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
