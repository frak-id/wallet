import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useDownloadRecoveryFile } from "@/module/recovery-setup/hook/useDownloadRecoveryFile";
import {
    recoveryOptionsAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { ButtonRipple } from "@module/component/ButtonRipple";
import { useAtomValue, useSetAtom } from "jotai";

const ACTUAL_STEP = 3;

export function Step3() {
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Download the recovery file
    const { downloadRecoveryFileAsync } = useDownloadRecoveryFile();

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={"Download recovery file"}
        >
            <ButtonRipple
                onClick={async () => {
                    if (!recoveryOptions) return;
                    await downloadRecoveryFileAsync({
                        file: recoveryOptions.file,
                    });
                    // Slight delay the next step, otherwise it will be too fast
                    setTimeout(() => {
                        setStep(ACTUAL_STEP + 1);
                    }, 1000);
                }}
            >
                Download my recovery file
            </ButtonRipple>
        </AccordionRecoveryItem>
    );
}
