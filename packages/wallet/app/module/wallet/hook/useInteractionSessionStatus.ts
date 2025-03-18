import { getSessionStatus } from "@/module/interaction/action/interactionSession";
import { interactionSessionAtom } from "@/module/wallet/atoms/interactionSession";
import { walletQueryKeys } from "@/module/wallet/queryKeys/wallet";
import type { InteractionSession } from "@/types/Session";
import { jotaiStore } from "@shared/module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import type { UndefinedInitialDataOptions } from "@tanstack/react-query";
import { RESET } from "jotai/utils";
import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";

/**
 * The raw query data we will use to get the session status
 * @param address
 */
export const interactionSessionStatusQuery = (address?: Address) => ({
    enabled: !!address,
    queryKey: walletQueryKeys.interactions.sessionStatus.byAddress(address),
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
