"use client";

import { Step1 } from "@/module/recovery-setup/component/Setup/Step1";
import { Step2 } from "@/module/recovery-setup/component/Setup/Step2";
import { Step3 } from "@/module/recovery-setup/component/Setup/Step3";
import { Step4 } from "@/module/recovery-setup/component/Setup/Step4";
import {
    recoveryResetAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { Accordion } from "@module/component/Accordion";
import { useAtomValue, useSetAtom } from "jotai";
import { TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { Trans } from "react-i18next";
import styles from "./index.module.css";

const MAX_STEPS = 5;

export function SetupRecovery() {
    const recoveryReset = useSetAtom(recoveryResetAtom);
    const step = useAtomValue(recoveryStepAtom);

    useEffect(() => {
        return () => {
            if (step !== MAX_STEPS) return;
            // Reset the state when leaving the component
            recoveryReset();
        };
    }, [step, recoveryReset]);

    return (
        <>
            <p className={styles.setupRecovery__disclaimer}>
                <TriangleAlert />{" "}
                <Trans i18nKey={"wallet.recoverySetup.disclaimer"} />
            </p>
            <Accordion type={"single"} collapsible value={`step-${step}`}>
                <Step1 />
                <Step2 />
                <Step3 />
                <Step4 />
            </Accordion>
        </>
    );
}
