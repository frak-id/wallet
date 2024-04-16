import { ButtonRipple } from "@/module/common/component/ButtonRipple";
import { AccordionRecoveryItem } from "@/module/recovery/component/AccordionItem";
import { getStatusCurrentStep } from "@/module/recovery/component/Setup";
import { useDownloadRecoveryFile } from "@/module/recovery/hook/useDownloadRecoveryFile";
import { useParseRecoveryFile } from "@/module/recovery/hook/useParseRecoveryFile";
import {
    recoveryOptionsAtom,
    recoveryPasswordAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { useAtom, useAtomValue } from "jotai";
import { useEffect, useState } from "react";

const ACTUAL_STEP = 3;

export function Step3() {
    // Get or set the current step
    const [step, setStep] = useAtom(recoveryStepAtom);

    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Get the password
    const password = useAtomValue(recoveryPasswordAtom);

    // Parse the recovery file
    const { parseRecoveryFileAsync } = useParseRecoveryFile();

    // Download the recovery file
    const { downloadRecoveryFileAsync } = useDownloadRecoveryFile();

    // State to check if the download is ready
    const [downloadReady, setDownloadReady] = useState<boolean | undefined>(
        undefined
    );

    /**
     * Run when the step is 3 and the recovery options are set
     */
    useEffect(() => {
        if (step !== ACTUAL_STEP || !recoveryOptions) return;

        async function runStep() {
            if (!(recoveryOptions && password)) return;

            try {
                await parseRecoveryFileAsync({
                    file: recoveryOptions.file,
                    pass: password,
                });
                setDownloadReady(true);
            } catch (error) {
                console.error("Error parsing recovery file", error);
                setDownloadReady(false);
            }
        }
        runStep();
    }, [step, recoveryOptions, parseRecoveryFileAsync, password]);

    return (
        <AccordionRecoveryItem
            item={`step-${ACTUAL_STEP}`}
            trigger={<span>{ACTUAL_STEP}. Download recovery file</span>}
            status={getStatusCurrentStep(ACTUAL_STEP, step)}
        >
            {downloadReady && (
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
            )}
            {downloadReady === false && (
                <p className={"error"}>Failed to prepare the recovery file</p>
            )}
        </AccordionRecoveryItem>
    );
}
