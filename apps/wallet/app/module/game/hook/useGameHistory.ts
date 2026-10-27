import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";

const gameHistoryKeys = {
    all: ["game", "history"] as const,
};

/** The user's ended games, latest first, with their tickets and how the draw went. */
export function useGameHistory() {
    return useQuery({
        queryKey: gameHistoryKeys.all,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.game.history.get();
            if (error) throw error;
            return data.games;
        },
        enabled: frakGame.enabled,
    });
}
