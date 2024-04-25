import { availableChains } from "@/context/common/blockchain/provider";
import type { AvailableChainIds } from "@/context/common/blockchain/provider";
import { Button } from "@/module/common/component/Button";
import { usePerformRecoveryOnChain } from "@/module/recovery/hook/usePerformRecoveryOnChain";
import { recoveryDoneStepAtom } from "@/module/settings/atoms/recovery";
import type { RecoveryFileContent } from "@/types/Recovery";
import type { WebAuthNWallet } from "@/types/WebAuthN";
import { useSetAtom } from "jotai";
import { Check, X } from "lucide-react";
import { forwardRef, useCallback, useMemo } from "react";
import { extractChain } from "viem";
import type { LocalAccount } from "viem";

type ButtonRecoverForChainProps = {
    recoveryFileContent: RecoveryFileContent;
    guardianAccount: LocalAccount<string>;
    chainId: AvailableChainIds;
    available: boolean;
    alreadyRecovered: boolean | undefined;
    targetWallet: WebAuthNWallet;
    className?: string;
};

export const ButtonRecoverForChain = forwardRef<
    HTMLButtonElement,
    ButtonRecoverForChainProps
>(
    (
        {
            recoveryFileContent,
            guardianAccount,
            chainId,
            available,
            alreadyRecovered,
            targetWallet,
            className = "",
        },
        ref
    ) => {
        const { performRecoveryAsync, isPending, isSuccess, isError, error } =
            usePerformRecoveryOnChain(chainId);

        // Set the done steps
        const setDoneSteps = useSetAtom(recoveryDoneStepAtom);

        const doRecover = useCallback(async () => {
            // Perform the recovery
            const txHash = await performRecoveryAsync({
                file: recoveryFileContent,
                recoveryAccount: guardianAccount,
                newWallet: targetWallet,
            });
            txHash && setDoneSteps((count) => count + 1);
        }, [
            performRecoveryAsync,
            recoveryFileContent,
            guardianAccount,
            targetWallet,
            setDoneSteps,
        ]);

        const chainName = useMemo(
            () => extractChain({ chains: availableChains, id: chainId }).name,
            [chainId]
        );

        if (!available) {
            return null;
        }

        return (
            <>
                <Button
                    ref={ref}
                    isLoading={isPending}
                    disabled={isPending || isSuccess || alreadyRecovered}
                    onClick={doRecover}
                    LeftIcon={isSuccess ? Check : isError ? X : undefined}
                    fontSize={"normal"}
                    className={className}
                >
                    {alreadyRecovered && (
                        <>Wallet already recovered on {chainName}</>
                    )}
                    {!alreadyRecovered && <>Recover on {chainName}</>}
                </Button>
                {error && <span className="error">{error.message}</span>}
            </>
        );
    }
);
