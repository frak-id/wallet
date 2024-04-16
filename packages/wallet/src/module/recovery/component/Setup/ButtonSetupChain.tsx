import { Button } from "@frak-labs/nexus-example/src/module/common/component/Button";
import { useSetupRecovery } from "@/module/recovery/hook/useSetupRecovery";
import { useAtomValue } from "jotai/index";
import { recoveryOptionsAtom } from "@/module/settings/atoms/recovery";
import type { Chain } from "viem";
import { Check } from "lucide-react";

export function ButtonSetupChain({ chain }: { chain: Chain }) {
    // Get the recovery options
    const recoveryOptions = useAtomValue(recoveryOptionsAtom);

    // Setup recovery
    const { setupRecoveryAsync, isPending, isSuccess } = useSetupRecovery();

    return (
        <Button
            isLoading={isPending}
            disabled={isPending || isSuccess}
            onClick={async () => {
                if (!recoveryOptions) return;
                const txHash = await setupRecoveryAsync({
                    chainId: chain.id,
                    setupTxData: recoveryOptions.setupTxData,
                });
                console.log("Tx hash", txHash);
            }}
            LeftIcon={isSuccess ? Check : undefined}
        >
            Setup recovery for {chain.name}
        </Button>
    );
}
