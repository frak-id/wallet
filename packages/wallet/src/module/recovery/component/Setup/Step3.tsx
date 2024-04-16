import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { AccordionRecoveryItem } from "@/module/recovery/component/AccordionItem";
import { getStatusCurrentStep } from "@/module/recovery/component/Setup";
import { useDownloadRecoveryFile } from "@/module/recovery/hook/useDownloadRecoveryFile";
import {
    recoveryOptionsAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom, useAtomValue } from "jotai";

const ACTUAL_STEP = 3;

export function Step3() {
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);

    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Download the recovery file
    const { downloadRecoveryFileAsync } = useDownloadRecoveryFile();

    return (
        <AccordionRecoveryItem
            item={`step-${ACTUAL_STEP}`}
            trigger={<span>{ACTUAL_STEP}. Download recovery file</span>}
            status={getStatusCurrentStep(ACTUAL_STEP, step)}
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
