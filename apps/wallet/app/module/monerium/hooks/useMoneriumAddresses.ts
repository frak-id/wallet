import { useQuery } from "@tanstack/react-query";
import { useConnection } from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import {
    getAddresses,
    isMoneriumRetryable,
} from "@/module/monerium/utils/moneriumApi";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useMoneriumAddresses() {
    const { address: walletAddress } = useConnection();
    const isConnected = moneriumStore(isMoneriumConnected);

    const query = useQuery({
        queryKey: moneriumKey.addresses,
        queryFn: async () => {
            const { addresses } = await getAddresses();

            const isWalletLinked =
                walletAddress !== undefined &&
                addresses.some(
                    (a) =>
                        a.address.toLowerCase() === walletAddress.toLowerCase()
                );

            return { addresses, isWalletLinked };
        },
        enabled: isConnected,
        staleTime: FIVE_MINUTES_MS,
        refetchOnWindowFocus: true,
        retry: (failureCount, err) =>
            failureCount < 3 && isMoneriumRetryable(err),
    });

    return {
        addresses: query.data?.addresses ?? [],
        isWalletLinked: query.data?.isWalletLinked ?? false,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
