import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";

/**
 * Use the current session status
 */
export function useInteractionSessionStatus({
    address,
}: { address?: Address }) {
    return useQuery({
        queryKey: ["interactions", "session-status"],
        queryFn: async () => {
            if (!address) {
                return null;
            }
            return getSessionStatus({ wallet: address });
        },
        enabled: !!address,
    });
}
