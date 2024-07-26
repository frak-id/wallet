import { getSessionStatus } from "@/context/interaction/action/interactionSession";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import type { InteractionSession } from "@/types/Session";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import type { UndefinedInitialDataOptions } from "@tanstack/react-query";
import type { Address } from "viem";

/**
 * Use the current session status
 */
export function useInteractionSessionStatus({
    address,
    query,
}: {
    address?: Address;
    query?: Partial<UndefinedInitialDataOptions<InteractionSession | null>>;
}) {
    return useQuery({
        ...query,
        queryKey: ["interactions", "session-status"],
        queryFn: async () => {
            if (!address) {
                return null;
            }
            const session = await getSessionStatus({ wallet: address });
            jotaiStore.set(interactionSessionAtom, session);
            return session;
        },
        enabled: !!address,
    });
}
