import { Button } from "@frak-labs/ui/component/Button";
import { X } from "lucide-react";
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
    const { downloadRecoveryFileAsync, isPending, isError, error, reset } =
        useDownloadRecoveryFile();

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recoverySetup.step3")}
        >
            <Button
                width={"full"}
                isLoading={isPending}
                disabled={isPending}
                leftIcon={isError ? <X /> : undefined}
                onClick={async (e) => {
                    // Prevent event propagation to avoid closing accordion
                    e.stopPropagation();
                    if (!recoveryOptions) return;

                    // Reset error state before retrying
                    if (isError) {
                        reset();
                    }

                    try {
                        await downloadRecoveryFileAsync({
                            file: recoveryOptions.file,
                        });
                        // Slight delay the next step, otherwise it will be too fast
                        setTimeout(() => {
                            recoveryStore.getState().setStep(ACTUAL_STEP + 1);
                        }, 1000);
                    } catch {
                        // Error is captured by mutation state, no need to log here
                    }
                }}
            >
                {t("wallet.recoverySetup.download")}
            </Button>
            {isError && (
                <span className="error">
                    {error?.message ?? t("common.error")}
                </span>
            )}
        </AccordionRecoveryItem>
    );
}
