import { useLogin } from "@/module/authentication/hook/useLogin";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import {
    recoveryFileContentAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { Button } from "@module/component/Button";
import { WalletAddress } from "@module/component/HashDisplay";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import { useTranslation } from "react-i18next";
import { toHex } from "viem";
import styles from "./Step2.module.css";

const ACTUAL_STEP = 2;

export function Step2() {
    const { t } = useTranslation();
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Get the recovery file
    const fileContent = useAtomValue(recoveryFileContentAtom);

    const router = useRouter();
    const [, startTransition] = useTransition();

    // Get the login function in case passkey is still on device
    const { login, isLoading } = useLogin();

    const triggerContinueRecovery = useCallback(async () => {
        if (
            !(
                fileContent?.initialWallet?.address &&
                fileContent?.initialWallet?.authenticatorId
            )
        )
            return;

        try {
            const wallet = await login({
                lastAuthentication: {
                    wallet: fileContent?.initialWallet?.address,
                    authenticatorId:
                        fileContent?.initialWallet?.authenticatorId,
                },
            });

            // If no wallet, go to the next step
            if (!wallet) setStep(ACTUAL_STEP + 1);

            // If login is in success, go to the wallet
            if (wallet) {
                startTransition(() => {
                    router.push("/wallet");
                });
            }
        } catch (e) {
            console.error(e);
            setStep(ACTUAL_STEP + 1);
        }
    }, [fileContent, login, setStep, router]);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={t("wallet.recovery.step2")}
        >
            <p>
                {t("common.walletAddress")}{" "}
                <WalletAddress
                    wallet={fileContent?.initialWallet?.address ?? "0x"}
                    copiedText={t("common.copied")}
                />
                <br />
                {t("common.authenticator")}{" "}
                <WalletAddress
                    wallet={toHex(
                        fileContent?.initialWallet?.authenticatorId ?? "0"
                    )}
                    copiedText={t("common.copied")}
                />
            </p>
            <p>
                <Button
                    width={"full"}
                    className={styles.step2__button}
                    disabled={isLoading}
                    isLoading={isLoading}
                    onClick={triggerContinueRecovery}
                >
                    {t("wallet.recovery.continue")}
                </Button>
            </p>
        </AccordionRecoveryItem>
    );
}
