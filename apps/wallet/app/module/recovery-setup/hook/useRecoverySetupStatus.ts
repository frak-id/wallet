import { useConnection } from "wagmi";
import { useCurrentRecoveryOption } from "@/module/recovery/hook/useCurrentRecoveryOption";

/**
 * On-chain recovery status for the connected wallet — a thin wrapper over the
 * shared `useCurrentRecoveryOption` reader.
 */
export function useRecoverySetupStatus() {
    const { address } = useConnection();
    const { data, ...queryStuff } = useCurrentRecoveryOption(address);
    return {
        ...queryStuff,
        recoverySetupStatus: data,
    };
}
