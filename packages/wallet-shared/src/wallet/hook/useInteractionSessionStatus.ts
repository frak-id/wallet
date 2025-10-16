import { jotaiStore } from "@frak-labs/ui/atoms/store";
import type { UndefinedInitialDataOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { RESET } from "jotai/utils";
import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";
import { getSessionStatus } from "@/interaction/action/interactionSession";
import type { InteractionSession } from "@/types/Session";
import { interactionSessionAtom } from "@/wallet/atoms/interactionSession";
import { interactionsKey } from "@/wallet/queryKeys/interactions";

/**
 * The raw query data we will use to get the session status
 * @param address
 */
export const interactionSessionStatusQuery = (address?: Address) => ({
    enabled: !!address,
    queryKey: interactionsKey.sessionStatus.byAddress(address),
    queryFn: async () => {
        if (!address) {
            return null;
        }
        const session = await getSessionStatus({ wallet: address });
        jotaiStore.set(interactionSessionAtom, session ?? RESET);
        return session;
    },
});

/**
 * Use the current session status
 */
export function useInteractionSessionStatus({
    address: paramAddress,
    query,
}: {
    address?: Address;
    query?: Partial<UndefinedInitialDataOptions<InteractionSession | null>>;
} = {}) {
    const wagmiAddress = useAccount().address;
    const address = useMemo(
        () => paramAddress ?? wagmiAddress,
        [paramAddress, wagmiAddress]
    );

    return useQuery({
        ...query,
        ...interactionSessionStatusQuery(address),
    });
}
