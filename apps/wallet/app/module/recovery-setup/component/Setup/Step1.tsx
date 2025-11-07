import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { Password } from "@/module/common/component/Password";
import { recoveryStore } from "@/module/stores/recoveryStore";

const ACTUAL_STEP = 1;

export function Step1() {
    const { t } = useTranslation();

    // Submit handler that handles the form password submission
    const onSubmit = async ({ password }: { password: string }) => {
        recoveryStore.getState().setPassword(password);
        recoveryStore.getState().setStep(ACTUAL_STEP + 1);
    };

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recoverySetup.step1")}
        >
            <Password onSubmit={onSubmit} />
        </AccordionRecoveryItem>
    );
}
