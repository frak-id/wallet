import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { openSessionAtom } from "@/module/wallet/atoms/openSession";
import { jotaiStore } from "@module/atoms/store";
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
            const sessionStatus = await getSessionStatus({ wallet: address });
            jotaiStore.set(openSessionAtom, sessionStatus);
            return sessionStatus;
        },
        enabled: !!address,
    });
}
