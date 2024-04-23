import { useSetupRecovery } from "@/module/recovery-setup/hook/useSetupRecovery";
import {
    recoveryDoneStepAtom,
    recoveryOptionsAtom,
} from "@/module/settings/atoms/recovery";
import { Button } from "@frak-labs/nexus-example/src/module/common/component/Button";
import { useSetAtom } from "jotai";
import { useAtomValue } from "jotai/index";
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
                className={className}
            >
                Setup recovery for {chain.name}
            </Button>
            <span className="error">{isError ? error.message : ""}</span>
        </>
    );
}
