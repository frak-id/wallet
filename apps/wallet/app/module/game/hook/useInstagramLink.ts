import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";
import { gameHistoryKeys } from "@/module/game/hook/useGameHistory";

export const instagramKeys = {
    status: ["game", "instagram", "status"] as const,
    code: ["game", "instagram", "code"] as const,
};

async function fetchStatus() {
    const { data, error } = await authenticatedWalletApi.instagram.get();
    if (error) throw error;
    return data;
}

/** Both levels as the backend reports them; the IGSID never reaches the wallet. */
export type InstagramStatus = Awaited<ReturnType<typeof fetchStatus>>;
export type InstagramLink = NonNullable<InstagramStatus["link"]>;
export type InstagramDeclaration = NonNullable<InstagramStatus["declaration"]>;

/** The caller's certified link and declared handle, each `null` when absent. */
export function useInstagramStatus() {
    return useQuery({
        queryKey: instagramKeys.status,
        queryFn: fetchStatus,
        enabled: frakGame.enabled,
    });
}

/** The code the player DMs to @frak_fr; the backend keeps it until it is used. */
export function useInstagramLinkCode({ enabled }: { enabled: boolean }) {
    return useQuery({
        queryKey: instagramKeys.code,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.instagram.code.post();
            if (error) throw error;
            return data.code;
        },
        enabled: frakGame.enabled && enabled,
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });
}

/** Caches a status the backend just returned, then re-reads what depends on it. */
export function useSyncInstagramStatus() {
    const queryClient = useQueryClient();
    return (status: InstagramStatus) => {
        queryClient.setQueryData(instagramKeys.status, status);
        void queryClient.invalidateQueries({ queryKey: currentGameKeys.all });
        void queryClient.invalidateQueries({ queryKey: gameHistoryKeys.all });
    };
}

/** Re-reads the certified follow from Instagram, or picks up a link the webhook just made. */
export function useCheckInstagram() {
    const sync = useSyncInstagramStatus();
    return useMutation({
        mutationFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.instagram.check.post();
            if (error) throw error;
            return data;
        },
        onSuccess: sync,
    });
}

/** Declares or drops the typed handle. */
export function useDeclareInstagram() {
    const sync = useSyncInstagramStatus();

    const declare = useMutation({
        mutationFn: async (username: string) => {
            const { data, error } =
                await authenticatedWalletApi.instagram.declaration.put({
                    username,
                });
            if (error) throw error;
            return data;
        },
        onSuccess: sync,
    });

    const remove = useMutation({
        mutationFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.instagram.declaration.delete();
            if (error) throw error;
            return data;
        },
        onSuccess: sync,
    });

    return { declare, remove };
}
