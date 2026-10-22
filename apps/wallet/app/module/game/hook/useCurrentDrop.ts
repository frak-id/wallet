import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";

export const currentDropKeys = {
    all: ["game", "drops", "current"] as const,
};

/** The open game (a drop) and whether the user joined it; `null` when none is open. */
export function useCurrentDrop() {
    return useQuery({
        queryKey: currentDropKeys.all,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.game.drops.current.get();
            if (error) throw error;
            return data.drop;
        },
        enabled: frakGame.enabled,
    });
}
