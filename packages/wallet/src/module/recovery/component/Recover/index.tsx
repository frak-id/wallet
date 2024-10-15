"use client";

import { Title } from "@/module/common/component/Title";
import { Step1 } from "@/module/recovery/component/Recover/Step1";
import { Step2 } from "@/module/recovery/component/Recover/Step2";
import { Step3 } from "@/module/recovery/component/Recover/Step3";
import { Step4 } from "@/module/recovery/component/Recover/Step4";
import { Step5 } from "@/module/recovery/component/Recover/Step5";
import { Step6 } from "@/module/recovery/component/Recover/Step6";
import {
    recoveryResetAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { Accordion } from "@module/component/Accordion";
import { useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const MAX_STEPS = 6;

/**
 * Recover a wallet component
 * @constructor
 */
export function RecoverWallet() {
    const { t } = useTranslation();
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
            <Title>{t("wallet.recovery.title")}</Title>
            <Accordion type={"single"} collapsible value={`step-${step}`}>
                <Step1 />
                <Step2 />
                <Step3 />
                <Step4 />
                <Step5 />
                <Step6 />
            </Accordion>
        </>
    );
}
