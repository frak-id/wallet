import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { ButtonSetupRecovery } from "@/module/recovery-setup/component/Setup/ButtonSetupRecovery";
import { recoveryStepAtom } from "@/module/settings/atoms/recovery";
import { useSetAtom } from "jotai";
import styles from "./Step4.module.css";

const ACTUAL_STEP = 4;

export function Step4() {
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={"Enable recovery on-chain"}
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
