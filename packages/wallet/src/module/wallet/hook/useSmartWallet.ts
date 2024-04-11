import type { KernelWebAuthNSmartAccount } from "@/context/wallet/smartWallet/WebAuthNSmartWallet";
import { useMemo } from "react";
import { useConnectorClient } from "wagmi";

/**
 * Use a chain specific wallet
 * @param chainId
 */
export function useSmartWallet({ chainId }: { chainId?: number } = {}) {
    const { data: connector } = useConnectorClient({ chainId });

    return useMemo(
        () => connector?.account as KernelWebAuthNSmartAccount | undefined,
        [connector?.account]
    );
}
