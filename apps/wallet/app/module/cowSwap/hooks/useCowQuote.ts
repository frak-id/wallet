import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { useConnection } from "wagmi";
import { cowSwapKey } from "@/module/cowSwap/queryKeys/cowSwap";
import { fetchCowQuote } from "@/module/cowSwap/utils/cowApi";

/** Live CoW quote, refreshed before the orderbook's quote expires. */
export function useCowQuote(params: {
    sellToken: Address;
    buyToken: Address;
    sellAmount: bigint;
    enabled?: boolean;
}) {
    const { address } = useConnection();
    const { sellToken, buyToken, sellAmount, enabled = true } = params;

    return useQuery({
        queryKey: cowSwapKey.quote(sellToken, buyToken, sellAmount.toString()),
        queryFn: () => {
            if (!address) throw new Error("No wallet connected");
            return fetchCowQuote({
                sellToken,
                buyToken,
                sellAmount,
                owner: address,
            });
        },
        enabled: enabled && !!address && sellAmount > 0n,
        refetchInterval: 30_000,
        staleTime: 15_000,
        retry: false,
    });
}
