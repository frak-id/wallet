import { useQuery } from "@tanstack/react-query";
import { getLeaderboard } from "@/module/game/utils/getLeaderboard";

export const leaderboardKeys = {
    all: ["game", "leaderboard"] as const,
};

export function useLeaderboard() {
    return useQuery({
        queryKey: leaderboardKeys.all,
        queryFn: getLeaderboard,
    });
}
