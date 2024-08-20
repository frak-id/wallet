import { getCurrentRecoveryOption } from "@/context/recover/action/get";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

/**
 * Fetch the recovery status for the given chain
 */
export function useRecoverySetupStatus() {
    const { address } = useAccount();

    const { data, ...queryStuff } = useQuery({
        queryKey: ["recovery", "status", address],
        gcTime: 0,
        enabled: !!address,
        queryFn: async () => {
            if (!address) return null;
            // Fetch the recovery options
            const options = await getCurrentRecoveryOption({
                wallet: address,
            });
            return options ?? null;
        },
    });
    return {
        ...queryStuff,
        recoverySetupStatus: data,
    };
}
