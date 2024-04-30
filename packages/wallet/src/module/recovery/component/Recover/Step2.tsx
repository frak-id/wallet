import { useLogin } from "@/module/authentication/hook/useLogin";
import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { Button } from "@/module/common/component/Button";
import {
    recoveryFileContentAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { WalletAddress } from "@/module/wallet/component/WalletAddress";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";
import styles from "./Step2.module.css";

const ACTUAL_STEP = 2;

export function Step2() {
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
            const { wallet } = await login({
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
            title={"Review recovery data"}
        >
            <p>
                Wallet address:{" "}
                <WalletAddress
                    wallet={fileContent?.initialWallet?.address ?? "0x"}
                />
                <br />
                Authenticator:{" "}
                <WalletAddress
                    wallet={fileContent?.initialWallet?.authenticatorId ?? "0"}
                />
            </p>
            <p>
                <Button
                    fontSize={"normal"}
                    className={styles.step2__button}
                    disabled={isLoading}
                    isLoading={isLoading}
                    onClick={triggerContinueRecovery}
                >
                    Continue recovery
                </Button>
            </p>
        </AccordionRecoveryItem>
    );
}
