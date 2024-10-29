import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { Password } from "@/module/common/component/Password";
import {
    recoveryPasswordAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

const ACTUAL_STEP = 1;

export function Step1() {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Set the password for recovery
    const setPassword = useSetAtom(recoveryPasswordAtom);

    // Submit handler that handles the form password submission
    const onSubmit = async ({ password }: { password: string }) => {
        setPassword(password);
        setStep(ACTUAL_STEP + 1);
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
