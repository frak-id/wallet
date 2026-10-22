import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";

export const currentGameKeys = {
    all: ["game", "current"] as const,
};

/** The open game (`null` when none is open) and the user's standing in it. */
export function useCurrentGame() {
    return useQuery({
        queryKey: currentGameKeys.all,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.game.current.get();
            if (error) throw error;
            return data;
        },
        enabled: frakGame.enabled,
    });
}
