import { Button } from "@frak-labs/ui/component/Button";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useCreateRecoveryPasskey } from "@/module/recovery/hook/useCreateRecoveryPasskey";
import {
    recoveryFileContentAtom,
    recoveryNewWalletAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import styles from "./Step4.module.css";

const ACTUAL_STEP = 4;

export function Step4() {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Set the new wallet
    const setNewWallet = useSetAtom(recoveryNewWalletAtom);

    // Get the recovery file product
    const recoveryFileContent = useAtomValue(recoveryFileContentAtom);

    // Register the new wallet
    const { createRecoveryPasskeyAsync, error, isPending } =
        useCreateRecoveryPasskey();

    const triggerAction = useCallback(async () => {
        if (!recoveryFileContent) return;
        const { wallet } = await createRecoveryPasskeyAsync({
            file: recoveryFileContent,
        });
        if (!Array.isArray(wallet.publicKey)) {
            console.error("Invalid wallet public key", wallet.publicKey);
            return;
        }
        setNewWallet(wallet as WebAuthNWallet);
        setStep(ACTUAL_STEP + 1);
    }, [
        createRecoveryPasskeyAsync,
        setNewWallet,
        setStep,
        recoveryFileContent,
    ]);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step4")}
        >
            <p>{t("wallet.recovery.needCreatePasskey")}</p>
            <Button
                width={"full"}
                onClick={triggerAction}
                disabled={isPending}
                isLoading={isPending}
                className={styles.step4__button}
            >
                {t("wallet.recovery.createPasskey")}
            </Button>
            {error && <span className="error">{error.message}</span>}
        </AccordionRecoveryItem>
    );
}
