import { availableChains } from "@/context/common/blockchain/provider";
import type { AvailableChainIds } from "@/context/common/blockchain/provider";
import { usePerformRecoveryOnChain } from "@/module/recovery/hook/usePerformRecoveryOnChain";
import {
    recoveryDoneStepAtom,
    recoveryExecuteOnChainInProgressAtom,
    recoveryTriggerExecuteOnChainAtom,
} from "@/module/settings/atoms/recovery";
import { ExplorerLink } from "@/module/wallet/component/PolygonLink";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useAtomValue } from "jotai";
import { useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo } from "react";
import { extractChain } from "viem";
import type { LocalAccount } from "viem";
import styles from "./RecoverChainStatus.module.css";

type RecoverChainStatusProps = {
    recoveryFileContent: RecoveryFileContent;
    guardianAccount: LocalAccount<string>;
    chainId: AvailableChainIds;
    available: boolean;
    alreadyRecovered: boolean | undefined;
    targetWallet: WebAuthNWallet;
};

export function RecoverChainStatus({
    recoveryFileContent,
    guardianAccount,
    chainId,
    available,
    alreadyRecovered,
    targetWallet,
}: RecoverChainStatusProps) {
    // Get in progress current count
    const triggerExecuteOnChain = useAtomValue(
        recoveryTriggerExecuteOnChainAtom
    );

    // Set the in progress array
    const setExecuteOnChainInProgress = useSetAtom(
        recoveryExecuteOnChainInProgressAtom
    );

    const {
        performRecoveryAsync,
        isPending,
        isSuccess,
        isError,
        data: txHash,
    } = usePerformRecoveryOnChain(chainId);

    // Set the done steps
    const setDoneSteps = useSetAtom(recoveryDoneStepAtom);

    const doRecover = useCallback(async () => {
        // Perform the recovery
        try {
            // Add to the in progress array
            setExecuteOnChainInProgress((prev) => [...prev, true]);
            const txHash = await performRecoveryAsync({
                file: recoveryFileContent,
                recoveryAccount: guardianAccount,
                newWallet: targetWallet,
            });
            txHash && setDoneSteps((count) => count + 1);
        } catch (error) {
            console.error(error);
            // Remove from the in progress array, to be able to retry
            setExecuteOnChainInProgress((prev) => prev.slice(0, -1));
        }
    }, [
        performRecoveryAsync,
        recoveryFileContent,
        guardianAccount,
        targetWallet,
        setDoneSteps,
        setExecuteOnChainInProgress,
    ]);

    const currentStatus = useMemo(() => {
        if (alreadyRecovered) {
            return (
                <span className={styles.recoverChainStatus__success}>
                    Wallet already recovered
                </span>
            );
        }
        if (isPending) {
            return (
                <span className={styles.recoverChainStatus__pending}>
                    In Progress
                    <span className={"dotsLoading"}>...</span>
                </span>
            );
        }
        if (isSuccess) {
            return (
                <span className={styles.recoverChainStatus__success}>
                    Done{" "}
                    <ExplorerLink
                        hash={txHash}
                        icon={false}
                        className={styles.recoverChainStatus__link}
                    />
                </span>
            );
        }
        if (isError) {
            return (
                <span className={styles.recoverChainStatus__error}>Error</span>
            );
        }
        return (
            <span className={styles.recoverChainStatus__pending}>Pending</span>
        );
    }, [isPending, isSuccess, isError, txHash, alreadyRecovered]);

    useEffect(() => {
        if (
            triggerExecuteOnChain === 0 ||
            alreadyRecovered ||
            isSuccess ||
            isPending
        )
            return;
        doRecover();
    }, [
        triggerExecuteOnChain,
        doRecover,
        alreadyRecovered,
        isSuccess,
        isPending,
    ]);

    const chainName = useMemo(
        () => extractChain({ chains: availableChains, id: chainId }).name,
        [chainId]
    );

    if (!available) {
        return null;
    }

    return (
        <p>
            {chainName}: {currentStatus}
        </p>
    );
}
