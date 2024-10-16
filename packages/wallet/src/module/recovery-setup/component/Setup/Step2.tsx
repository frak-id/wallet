import { sessionAtom } from "@/module/common/atoms/session";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useGenerateRecoveryOptions } from "@/module/recovery-setup/hook/useGenerateRecoveryOptions";
import {
    recoveryOptionsAtom,
    recoveryPasswordAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";

const ACTUAL_STEP = 2;

export function Step2() {
    const { t } = useTranslation();
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);

    // Get the password
    const password = useAtomValue(recoveryPasswordAtom);

    // Get the current session
    const session = useAtomValue(sessionAtom);

    // Set the recovery options
    const setRecoveryOptions = useSetAtom(recoveryOptionsAtom);

    // Generate recovery options
    const { generateRecoveryOptionsAsync } = useGenerateRecoveryOptions();

    useEffect(() => {
        if (step !== ACTUAL_STEP || !session || !password) return;

        // Generate recovery data
        // and mark the step as completed
        const recoveryOptions = generateRecoveryOptionsAsync({
            wallet: session,
            pass: password,
        });
        recoveryOptions.then((resRecoveryOptions) => {
            setRecoveryOptions(resRecoveryOptions);

            // Delay the next step, otherwise it will be too fast
            setTimeout(() => {
                setStep(ACTUAL_STEP + 1);
            }, 2000);
        });
    }, [
        generateRecoveryOptionsAsync,
        session,
        password,
        step,
        setRecoveryOptions,
        setStep,
    ]);

    return (
        <>
            <AccordionRecoveryItem
                actualStep={ACTUAL_STEP}
                title={t("wallet.recoverySetup.step2")}
            >
                <p>
                    {t("wallet.recoverySetup.generating")}
                    <span className={"dotsLoading"}>...</span>
                </p>
            </AccordionRecoveryItem>
        </>
    );
}
