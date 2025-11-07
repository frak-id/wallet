import { Button } from "@frak-labs/ui/component/Button";
import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useDownloadRecoveryFile } from "@/module/recovery-setup/hook/useDownloadRecoveryFile";
import {
    recoveryStore,
    selectRecoveryOptions,
} from "@/module/stores/recoveryStore";

const ACTUAL_STEP = 3;

export function Step3() {
    const { t } = useTranslation();

    // Get the recovery options
    const recoveryOptions = recoveryStore(selectRecoveryOptions);

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
                        recoveryStore.getState().setStep(ACTUAL_STEP + 1);
                    }, 1000);
                }}
            >
                {t("wallet.recoverySetup.download")}
            </Button>
        </AccordionRecoveryItem>
    );
}
