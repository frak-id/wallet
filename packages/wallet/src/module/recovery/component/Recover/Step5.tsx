import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { RecoverChainStatus } from "@/module/recovery/component/Recover/RecoverChainStatus";
import { useAvailableChainsForRecovery } from "@/module/recovery/hook/useAvailableChainsForRecovery";
import {
    recoveryDoneStepAtom,
    recoveryExecuteOnChainInProgressAtom,
    recoveryFileContentAtom,
    recoveryGuardianAccountAtom,
    recoveryNewWalletAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { SendHorizontal } from "lucide-react";
import { useEffect, useMemo } from "react";
import styles from "./Step5.module.css";

const ACTUAL_STEP = 5;

export function Step5() {
    // Get the recovery file content
    const recoveryFileContent = useAtomValue(recoveryFileContentAtom);

    return (
        <AccordionRecoveryItem
            actualStep={ACTUAL_STEP}
            title={"Execute recovery"}
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
    // Set the current step
    const setStep = useSetAtom(recoveryStepAtom);

    // Set the execute on chain in progress
    const [executeOnChainInProgress, setExecuteOnChainInProgress] = useAtom(
        recoveryExecuteOnChainInProgressAtom
    );

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
            }, 2000);
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

            {availableChains?.map(
                ({ chainId, available, alreadyRecovered }) => (
                    <RecoverChainStatus
                        key={chainId}
                        recoveryFileContent={recoveryFileContent}
                        guardianAccount={guardianAccount}
                        chainId={chainId}
                        available={available}
                        alreadyRecovered={alreadyRecovered}
                        targetWallet={newWallet}
                    />
                )
            )}

            {availableChainsToRecover &&
                availableChainsToRecover.length > 0 && (
                    <p className={styles.step5__pushPasskey}>
                        <button
                            type={"button"}
                            className={`button ${styles.step5__buttonPush}`}
                            disabled={executeOnChainInProgress > 0}
                            onClick={() =>
                                setExecuteOnChainInProgress((prev) => prev + 1)
                            }
                        >
                            Push new passkey on-chain <SendHorizontal />
                        </button>
                    </p>
                )}
        </>
    );
}
