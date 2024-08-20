import { AccordionRecoveryItem } from "@/module/common/component/AccordionRecoveryItem";
import { usePerformRecovery } from "@/module/recovery/hook/usePerformRecovery";
import { useRecoveryAvailability } from "@/module/recovery/hook/useRecoveryAvailability";
import {
    recoveryFileContentAtom,
    recoveryGuardianAccountAtom,
    recoveryNewWalletAtom,
    recoveryStepAtom,
} from "@/module/settings/atoms/recovery";
import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useAtomValue, useSetAtom } from "jotai";
import { SendHorizontal } from "lucide-react";
import { sleep } from "radash";
import { useMemo } from "react";
import type { Hex } from "viem";
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

    // Set the guardian account
    const guardianAccount = useAtomValue(recoveryGuardianAccountAtom);

    // Get the new authenticator id
    const newWallet = useAtomValue(recoveryNewWalletAtom);

    // Get the available chains for recovery
    const { recoveryAvailability, isLoading } = useRecoveryAvailability({
        file: recoveryFileContent,
        newAuthenticatorId: newWallet?.authenticatorId ?? "",
    });

    /**
     * Hook to perform the recovery
     */
    const {
        performRecovery,
        isPending,
        isSuccess,
        status,
        data: txHash,
    } = usePerformRecovery({
        onSuccess: async () => {
            // On success, wait 2sec on go to the next step
            await sleep(2000);
            setStep(ACTUAL_STEP + 1);
        },
    });

    /**
     * Check if the recovery is available
     */
    const isRecoveryAvailable = useMemo(() => {
        if (recoveryAvailability?.available === false) {
            return false;
        }

        return recoveryAvailability?.alreadyRecovered !== true;
    }, [recoveryAvailability]);

    const currentStatus = useRecoveryStatus({
        recoveryAvailability: recoveryAvailability,
        status: status,
        txHash: txHash,
    });

    if (!(guardianAccount && newWallet)) {
        return null;
    }

    if (isLoading || !recoveryAvailability) {
        return (
            <p>
                Loading recovery chains
                <span className={"dotsLoading"}>...</span>
            </p>
        );
    }

    return (
        <>
            {currentStatus}

            {isRecoveryAvailable && (
                <p className={styles.step5__pushPasskey}>
                    <button
                        type={"button"}
                        className={`button ${styles.step5__buttonPush}`}
                        disabled={
                            !isRecoveryAvailable || isPending || isSuccess
                        }
                        onClick={() =>
                            performRecovery({
                                file: recoveryFileContent,
                                newWallet,
                                recoveryAccount: guardianAccount,
                            })
                        }
                    >
                        Push new passkey on-chain <SendHorizontal />
                    </button>
                </p>
            )}
        </>
    );
}

function useRecoveryStatus({
    recoveryAvailability,
    status,
    txHash,
}: {
    recoveryAvailability:
        | { available: boolean; alreadyRecovered?: boolean }
        | undefined;
    status: "idle" | "pending" | "error" | "success";
    txHash?: Hex;
}) {
    return useMemo(() => {
        if (!recoveryAvailability) {
            return <p>Loading ...</p>;
        }

        if (recoveryAvailability?.alreadyRecovered) {
            return (
                <span className={styles.recoverChainStatus__success}>
                    Wallet already recovered
                </span>
            );
        }
        if (status === "pending") {
            return (
                <span className={styles.recoverChainStatus__pending}>
                    In Progress
                    <span className={"dotsLoading"}>...</span>
                </span>
            );
        }
        if (status === "success") {
            return (
                <span className={styles.recoverChainStatus__success}>
                    Done{" "}
                    <ExplorerLink
                        hash={txHash ?? "0x"}
                        icon={false}
                        className={styles.recoverChainStatus__link}
                    />
                </span>
            );
        }
        if (status === "error") {
            return (
                <span className={styles.recoverChainStatus__error}>Error</span>
            );
        }
        return (
            <span className={styles.recoverChainStatus__pending}>Pending</span>
        );
    }, [status, txHash, recoveryAvailability]);
}
