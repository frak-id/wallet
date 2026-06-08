import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { getCurrentRecoveryOption } from "@/module/recovery/action/get";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * Read a wallet's on-chain recovery executor (guardian + validity window), or
 * `null` when none is configured. Shared by the profile setup status (connected
 * wallet) and the restore flow's readiness check (a wallet being recovered) so
 * both hit a single cache entry per address instead of two parallel reads.
 */
export function useCurrentRecoveryOption(walletAddress?: Address) {
    return useQuery({
        queryKey: recoveryKey.currentOption.full({ walletAddress }),
        gcTime: 0,
        enabled: !!walletAddress,
        queryFn: () =>
            walletAddress
                ? getCurrentRecoveryOption({ wallet: walletAddress })
                : null,
    });
}
