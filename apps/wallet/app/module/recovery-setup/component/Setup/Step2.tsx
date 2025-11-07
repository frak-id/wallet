import { selectWebauthnSession, sessionStore } from "@frak-labs/wallet-shared";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useGenerateRecoveryOptions } from "@/module/recovery-setup/hook/useGenerateRecoveryOptions";
import {
    recoveryStore,
    selectRecoveryPassword,
    selectRecoveryStep,
} from "@/module/stores/recoveryStore";

const ACTUAL_STEP = 2;

export function Step2() {
    const { t } = useTranslation();

    // Get the current step and password
    const step = recoveryStore(selectRecoveryStep);
    const password = recoveryStore(selectRecoveryPassword);

    // Get the current session
    const session = sessionStore(selectWebauthnSession);

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
            recoveryStore.getState().setOptions(resRecoveryOptions);

            // Delay the next step, otherwise it will be too fast
            setTimeout(() => {
                recoveryStore.getState().setStep(ACTUAL_STEP + 1);
            }, 2000);
        });
    }, [generateRecoveryOptionsAsync, session, password, step]);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recoverySetup.step2")}
        >
            <p>
                {t("wallet.recoverySetup.generating")}
                <span className={"dotsLoading"}>...</span>
            </p>
        </AccordionRecoveryItem>
    );
}
