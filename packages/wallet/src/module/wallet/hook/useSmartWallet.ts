import type { NexusSmartAccount } from "@/context/wallet/smartWallet/NexusSmartWallet";
import { useMemo } from "react";
import { useConnectorClient } from "wagmi";

/**
 * Use a chain specific wallet
 * @param chainId
 */
export function useSmartWallet({ chainId }: { chainId?: number } = {}) {
    const { data: connector } = useConnectorClient({ chainId });

    return useMemo(
        () => connector?.account as NexusSmartAccount | undefined,
        [connector?.account]
    );
}
