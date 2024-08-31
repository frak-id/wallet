import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { useCreateRecoveryPasskey } from "@/module/recovery/hook/useCreateRecoveryPasskey";
import {
    recoveryFileContentAtom,
    recoveryNewWalletAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { Button } from "@module/component/Button";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback } from "react";
import styles from "./Step4.module.css";

const ACTUAL_STEP = 4;

export function Step4() {
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
        setNewWallet(wallet);
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
            title={"Create new passkey"}
        >
            <p>You need to create a new passkey on your device</p>
            <Button
                onClick={triggerAction}
                disabled={isPending}
                isLoading={isPending}
                className={styles.step4__button}
            >
                create passkey
            </Button>
            {error && <span className="error">{error.message}</span>}
        </AccordionRecoveryItem>
    );
}
