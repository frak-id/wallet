import { getInteractionHistory } from "@/context/history/action/interactionHistory";
import { useQuery } from "@tanstack/react-query";
import { useAccount } from "wagmi";

// Fetch the current wallet history
export function useGetInteractionHistory() {
    const { address } = useAccount();

    // The query fn that will fetch the history
    const { data: history } = useQuery({
        queryKey: ["history", "interaction", address],
        queryFn: async () => {
            return await getInteractionHistory({
                account: address ?? "0x",
            });
        },
        enabled: !!address,
    });

    return {
        history,
    };
}
