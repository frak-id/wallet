import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import {
    recoveryFileContentAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import type { RecoveryFileContent } from "@/types/Recovery";
import { Uploader } from "@shared/module/component/Uploader";
import { useAtom, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";

const ACTUAL_STEP = 1;

export function Step1() {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Get the recovery file product
    const [fileContent, setFileContent] = useAtom(recoveryFileContentAtom);

    /**
     * Handle the upload of a file
     */
    const handleChange = useCallback(
        async (files: File[] | null) => {
            if (!files || files.length === 0) {
                setFileContent(null);
                return null;
            }
            const fileText = await files[0].text();
            const fileContent = JSON.parse(fileText) as RecoveryFileContent;
            // Ensure all the fields are presents
            if (
                !fileContent.initialWallet ||
                !fileContent.guardianAddress ||
                !fileContent.guardianPrivateKeyEncrypted
            ) {
                // Should display a user message
                setFileContent(null);
                throw new Error(t("wallet.recovery.invalidFile"));
            }
            // If all good here, should check that the guardian address match the wallet address recovery options
            // A backend actions checking possible recovery chains???
            setFileContent(fileContent);
            setStep(ACTUAL_STEP + 1);
        },
        [setFileContent, setStep, t]
    );

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step1")}
        >
            <Uploader
                onDrop={handleChange}
                disabled={fileContent !== null}
                accept={{ "application/json": [".json"] }}
                text={t("wallet.recovery.uploadOrDrag")}
            />
        </AccordionRecoveryItem>
    );
}
