import {
    authenticatedWalletApi,
    balanceKey,
    claimableKey,
    getErrorCode,
    rewardsKey,
} from "@frak-labs/wallet-shared";
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
export function useInstagramLinkCode() {
    return useQuery({
        queryKey: instagramKeys.code,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.instagram.code.post();
            if (error) throw error;
            return data.code;
        },
        enabled: frakGame.enabled,
        staleTime: Number.POSITIVE_INFINITY,
        retry: false,
    });
}

/** Certifying can release the held welcome reward, so balances are re-read too. */
const DEPENDENT_KEYS = [
    currentGameKeys.all,
    gameHistoryKeys.all,
    rewardsKey.all,
    claimableKey.baseKey,
    balanceKey.baseKey,
];

/** Caches a status the backend just returned, then re-reads what depends on it. */
export function useSyncInstagramStatus() {
    const queryClient = useQueryClient();
    return (status: InstagramStatus) => {
        queryClient.setQueryData(instagramKeys.status, status);
        for (const queryKey of DEPENDENT_KEYS) {
            void queryClient.invalidateQueries({ queryKey });
        }
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

/** Declares or drops the typed handle. A 409 means the webhook certified meanwhile: the status is re-read. */
export function useDeclareInstagram() {
    const sync = useSyncInstagramStatus();
    const queryClient = useQueryClient();

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
        onError: (error) => {
            if (getErrorCode(error) !== "INSTAGRAM_ALREADY_CERTIFIED") return;
            void queryClient.invalidateQueries({
                queryKey: instagramKeys.status,
            });
        },
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
