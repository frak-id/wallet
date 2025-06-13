import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useDownloadRecoveryFile } from "@/module/recovery-setup/hook/useDownloadRecoveryFile";
import {
    recoveryOptionsAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { Button } from "@frak-labs/ui/component/Button";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";

const ACTUAL_STEP = 3;

export function Step3() {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Download the recovery file
    const { downloadRecoveryFileAsync } = useDownloadRecoveryFile();

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recoverySetup.step3")}
        >
            <Button
                width={"full"}
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
                {t("wallet.recoverySetup.download")}
            </Button>
        </AccordionRecoveryItem>
    );
}
