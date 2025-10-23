import { getSessionStatus } from "@frak-labs/wallet-shared/interaction/action/interactionSession";
import { walletStore } from "@frak-labs/wallet-shared/stores/walletStore";
import type { InteractionSession } from "@frak-labs/wallet-shared/types/Session";
import { interactionsKey } from "@frak-labs/wallet-shared/wallet/queryKeys/interactions";
import type { UndefinedInitialDataOptions } from "@tanstack/react-query";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount } from "wagmi";

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
        walletStore.getState().setInteractionSession(session ?? null);
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
