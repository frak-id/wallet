import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { ButtonSetupRecovery } from "@/module/recovery-setup/component/Setup/ButtonSetupRecovery";
import { recoveryStore } from "@/module/stores/recoveryStore";
import * as styles from "./Step4.css";

const ACTUAL_STEP = 4;

export function Step4() {
    const { t } = useTranslation();

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recoverySetup.step4")}
        >
            <ButtonSetupRecovery
                className={styles.button}
                onSuccess={() => {
                    recoveryStore.getState().setStep(ACTUAL_STEP + 1);
                }}
            />
        </AccordionRecoveryItem>
    );
}
