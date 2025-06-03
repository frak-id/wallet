import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { ButtonSetupRecovery } from "@/module/recovery-setup/component/Setup/ButtonSetupRecovery";
import { recoveryStepAtom } from "@/module/settings/atoms/recovery";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import styles from "./Step4.module.css";

const ACTUAL_STEP = 4;

export function Step4() {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recoverySetup.step4")}
        >
            <ButtonSetupRecovery
                className={styles.step4__button}
                onSuccess={() => {
                    setStep(ACTUAL_STEP + 1);
                }}
            />
        </AccordionRecoveryItem>
    );
}
