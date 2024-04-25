import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { ButtonRecoverForChain } from "@/module/recovery/component/Recover/ButtonRecoverForChain";
import { useAvailableChainsForRecovery } from "@/module/recovery/hook/useAvailableChainsForRecovery";
import {
    recoveryDoneStepAtom,
    recoveryFileContentAtom,
    recoveryGuardianAccountAtom,
    recoveryNewWalletAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useAtomValue, useSetAtom } from "jotai";
import { ArrowUp } from "lucide-react";
import { useEffect, useMemo, useRef } from "react";
import styles from "./Step5.module.css";

const ACTUAL_STEP = 5;

export function Step5() {
    // Get the recovery file content
    const recoveryFileContent = useAtomValue(recoveryFileContentAtom);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={"Enable recovery on-chain"}
        >
            {recoveryFileContent && (
                <TriggerRecovery recoveryFileContent={recoveryFileContent} />
            )}
        </AccordionRecoveryItem>
    );
}

function TriggerRecovery({
    recoveryFileContent,
}: { recoveryFileContent: RecoveryFileContent }) {
    // Buttons ref to trigger the recovery
    const buttonsRef = useRef<Array<HTMLButtonElement | null>>([]);

    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Set the guardian account
    const guardianAccount = useAtomValue(recoveryGuardianAccountAtom);

    // Get the new authenticator id
    const newWallet = useAtomValue(recoveryNewWalletAtom);

    // Get the done steps
    const doneSteps = useAtomValue(recoveryDoneStepAtom);

    // Get the available chains for recovery
    const { availableChains, isLoading } = useAvailableChainsForRecovery({
        file: recoveryFileContent,
        newAuthenticatorId: newWallet?.authenticatorId ?? "",
    });

    /**
     * Filter the available chains to recover to be able to go to the next step
     */
    const availableChainsToRecover = useMemo(
        () =>
            availableChains?.filter(
                (chain) => chain.available && !chain.alreadyRecovered
            ),
        [availableChains]
    );

    /**
     * If all the chains are recovered, go to the next step
     */
    useEffect(() => {
        if (doneSteps === availableChainsToRecover?.length) {
            setTimeout(() => {
                setStep(ACTUAL_STEP + 1);
            }, 500);
        }
    }, [doneSteps, setStep, availableChainsToRecover?.length]);

    if (isLoading) {
        return (
            <p>
                Loading recovery chains
                <span className={"dotsLoading"}>...</span>
            </p>
        );
    }

    if (!(guardianAccount && newWallet)) {
        return null;
    }

    return (
        <>
            {availableChains?.length === 0 && (
                <p>No available chains for recovery</p>
            )}

            {availableChains && availableChains.length > 0 && (
                <button
                    type={"button"}
                    className={`button ${styles.step5__buttonAll}`}
                    onClick={() => {
                        for (const el of buttonsRef.current) {
                            el?.click();
                        }
                    }}
                >
                    <ArrowUp /> Recover all chains
                </button>
            )}

            {availableChains?.map(
                ({ chainId, available, alreadyRecovered }, index) => (
                    <ButtonRecoverForChain
                        ref={(element: HTMLButtonElement) => {
                            buttonsRef.current[index] = element;
                        }}
                        key={chainId}
                        recoveryFileContent={recoveryFileContent}
                        guardianAccount={guardianAccount}
                        chainId={chainId}
                        available={available}
                        alreadyRecovered={alreadyRecovered}
                        targetWallet={newWallet}
                        className={styles.step5__button}
                    />
                )
            )}
        </>
    );
}
