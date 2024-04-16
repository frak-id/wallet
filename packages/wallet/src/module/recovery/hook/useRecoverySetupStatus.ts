import { getCurrentRecoveryOption } from "@/context/recover/action/get";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

/**
 * Fetch the recovery status for the given chain
 */
export function useRecoverySetupStatus({ chainId }: { chainId: number }) {
    const { address } = useAccount();

    const { data, ...queryStuff } = useQuery({
        queryKey: ["recovery", "status", address, chainId],
        gcTime: 0,
        enabled: !!address,
        queryFn: async () => {
            if (!address) return null;
            // Fetch the recovery options
            return getCurrentRecoveryOption({ wallet: address, chainId });
        },
    });
    return {
        ...queryStuff,
        recoverySetupStatus: data,
    };
}
