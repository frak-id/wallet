import { useConnection } from "wagmi";
import { useOnChainRecovery } from "@/module/recovery/hook/useOnChainRecovery";

/**
 * On-chain recovery status for the connected wallet — a thin wrapper over the
 * shared `useOnChainRecovery` reader.
 */
export function useConnectedWalletRecovery() {
    const { address } = useConnection();
    const { data, ...query } = useOnChainRecovery(address);
    return {
        ...query,
        onChainRecovery: data,
    };
}
