"use client";

import { fetchWalletHistory } from "@/context/history/action/fetchHistory";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

// Fetch the current wallet history
export function useGetHistory() {
    const { address } = useAccount();

    // The query fn that will fetch the history
    const {
        data: history,
        isPending: isLoading,
        isSuccess,
        isError,
        refetch,
    } = useQuery({
        queryKey: ["history", address],
        queryFn: async () => fetchWalletHistory({ account: address ?? "0x" }),
        enabled: !!address,
    });

    return {
        history,
        isLoading,
        isSuccess,
        isError,
        refetch,
    };
}
