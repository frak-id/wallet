import { Button } from "@/module/common/component/Button";
import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";
import {
    recoveryDoneStepAtom,
    recoveryOptionsAtom,
} from "@/module/settings/atoms/recovery";
import { useAtomValue, useSetAtom } from "jotai";
import { Check, X } from "lucide-react";
import type { Chain } from "viem";

export function ButtonSetupChain({
    chain,
    className = "",
}: { chain: Chain; className?: string }) {
    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Set the done steps
    const setDoneSteps = useSetAtom(recoveryDoneStepAtom);

    // Setup recovery
    const { setupRecoveryAsync, isPending, isSuccess, isError, error } =
        useSetupRecovery();

    return (
        <>
            <Button
                isLoading={isPending}
                disabled={isPending || isSuccess}
                onClick={async () => {
                    if (!recoveryOptions) return;
                    await setupRecoveryAsync({
                        chainId: chain.id,
                        setupTxData: recoveryOptions.setupTxData,
                    });
                    setDoneSteps((count) => count + 1);
                }}
                LeftIcon={isSuccess ? Check : isError ? X : undefined}
                fontSize={"normal"}
                className={className}
            >
                Setup recovery for {chain.name}
            </Button>
            <span className="error">{isError ? error.message : ""}</span>
        </>
    );
}
