import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import { getAddresses } from "@/module/monerium/utils/moneriumApi";
import { useMoneriumTokenRefresh } from "./useMoneriumClient";

const FIVE_MINUTES_MS = 5 * 60 * 1000;

export function useMoneriumAddresses() {
    const { address: walletAddress } = useAccount();
    const isConnected = moneriumStore(isMoneriumConnected);
    const accessToken = moneriumStore((s) => s.accessToken);
    const { isReady } = useMoneriumTokenRefresh();

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
        enabled: isConnected && isReady && !!accessToken,
        staleTime: FIVE_MINUTES_MS,
        refetchOnWindowFocus: true,
    });

    return {
        addresses: query.data?.addresses ?? [],
        isWalletLinked: query.data?.isWalletLinked ?? false,
        isLoading: query.isLoading,
        error: query.error,
        refetch: query.refetch,
    };
}
