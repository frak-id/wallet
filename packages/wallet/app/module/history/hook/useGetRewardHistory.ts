import { getRewardHistory } from "@/module/history/action/rewardHistory";
import { historyQueryKeys } from "@/module/history/queryKeys/history";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

// Fetch the current wallet history
export function useGetRewardHistory() {
    const { address } = useAccount();

    // The query fn that will fetch the history
    const { data: history } = useQuery({
        queryKey: historyQueryKeys.rewards.byAddress(address),
        queryFn: async () => {
            return await getRewardHistory({
                account: address ?? "0x",
            });
        },
        enabled: !!address,
    });

    return {
        history,
    };
}
