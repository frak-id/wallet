import { Button } from "@frak-labs/design-system/components/Button";
import { Text } from "@frak-labs/design-system/components/Text";
import { recordError, type WebAuthNWallet } from "@frak-labs/wallet-shared";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useCreateRecoveryPasskey } from "@/module/recovery/hook/useCreateRecoveryPasskey";
import {
    recoveryStore,
    selectRecoveryFileContent,
} from "@/module/stores/recoveryStore";
import * as styles from "./Step4.css";

const ACTUAL_STEP = 4;

export function Step4() {
    const { t } = useTranslation();
    // Get the recovery file product
    const recoveryFileContent = recoveryStore(selectRecoveryFileContent);

    // Register the new wallet
    const { createRecoveryPasskeyAsync, error, isPending } =
        useCreateRecoveryPasskey();

    const triggerAction = useCallback(async () => {
        if (!recoveryFileContent) return;
        const { wallet } = await createRecoveryPasskeyAsync({
            file: recoveryFileContent,
        });
        if (!Array.isArray(wallet.publicKey)) {
            recordError(new Error("Invalid wallet public key"), {
                source: "recovery",
                context: {
                    step: 4,
                    publicKey: String(wallet.publicKey),
                },
            });
            return;
        }
        recoveryStore.getState().setNewWallet(wallet as WebAuthNWallet);
        recoveryStore.getState().setStep(ACTUAL_STEP + 1);
    }, [createRecoveryPasskeyAsync, recoveryFileContent]);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step4")}
        >
            <Text>{t("wallet.recovery.needCreatePasskey")}</Text>
            <Button
                onClick={triggerAction}
                disabled={isPending}
                className={styles.button}
            >
                {t("wallet.recovery.createPasskey")}
            </Button>
            {error && <span className="error">{error.message}</span>}
        </AccordionRecoveryItem>
    );
}
