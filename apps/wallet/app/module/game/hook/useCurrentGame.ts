import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { queryOptions, useQuery } from "@tanstack/react-query";

export const currentGameKeys = {
    all: ["game", "current"] as const,
};

/** Shared by `useCurrentGame` and route guards, which read it outside React. */
export function currentGameQueryOptions() {
    return queryOptions({
        queryKey: currentGameKeys.all,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.game.current.get();
            if (error) throw error;
            return data;
        },
    });
}

/** The open game (`null` when none is open) and the user's standing in it. */
export function useCurrentGame() {
    return useQuery(currentGameQueryOptions());
}
