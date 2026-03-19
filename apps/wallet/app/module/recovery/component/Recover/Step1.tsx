import { Box } from "@frak-labs/design-system/components/Box";
import { Input } from "@frak-labs/design-system/components/Input";
import { Text } from "@frak-labs/design-system/components/Text";
import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import { type ChangeEvent, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import {
    recoveryStore,
    selectRecoveryFileContent,
} from "@/module/stores/recoveryStore";

const ACTUAL_STEP = 1;

export function Step1() {
    const { t } = useTranslation();
    // Get the recovery file product
    const fileContent = recoveryStore(selectRecoveryFileContent);

    /**
     * Handle the upload of a file
     */
    const handleChange = useCallback(
        async (event: ChangeEvent<HTMLInputElement>) => {
            const files = event.target.files
                ? Array.from(event.target.files)
                : null;
            if (!files || files.length === 0) {
                recoveryStore.getState().setFileContent(null);
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
                recoveryStore.getState().setFileContent(null);
                throw new Error(t("wallet.recovery.invalidFile"));
            }
            // If all good here, should check that the guardian address match the wallet address recovery options
            // A backend actions checking possible recovery chains???
            recoveryStore.getState().setFileContent(fileContent);
            recoveryStore.getState().setStep(ACTUAL_STEP + 1);
        },
        [t]
    );

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step1")}
        >
            <Box as="label">
                <Text as="span" variant="label">
                    {t("wallet.recovery.uploadOrDrag")}
                </Text>
                <Input
                    type="file"
                    accept="application/json,.json"
                    disabled={fileContent !== null}
                    onChange={handleChange}
                />
            </Box>
        </AccordionRecoveryItem>
    );
}
