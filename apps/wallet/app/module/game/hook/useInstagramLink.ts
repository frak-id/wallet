import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";

export const instagramKeys = {
    link: ["game", "instagram", "link"] as const,
    code: ["game", "instagram", "code"] as const,
};

async function fetchLink() {
    const { data, error } = await authenticatedWalletApi.instagram.get();
    if (error) throw error;
    return data.link;
}

/** The linked account as the backend reports it; the IGSID never reaches the wallet. */
export type InstagramLink = NonNullable<Awaited<ReturnType<typeof fetchLink>>>;

// shortcut: mocked until FRA-369 ships POST /instagram/code and POST /instagram/check; swap `fetchCode` for the API call and have the check mutation POST.
async function fetchCode() {
    return { code: "K7Q2PX" };
}

/** The caller's linked Instagram account, `null` when none is linked. */
export function useInstagramLink() {
    return useQuery({
        queryKey: instagramKeys.link,
        queryFn: fetchLink,
        enabled: frakGame.enabled,
    });
}

/** One-time code the player sends to @frak_fr; it also rides on the ig.me `ref`. */
export function useInstagramLinkCode() {
    return useQuery({
        queryKey: instagramKeys.code,
        queryFn: fetchCode,
        enabled: frakGame.enabled,
    });
}

/** Caches a link the backend just returned, then re-reads the game's eligibility. */
export function useSyncInstagramLink() {
    const queryClient = useQueryClient();
    return (link: InstagramLink | null) => {
        queryClient.setQueryData(instagramKeys.link, link);
        void queryClient.invalidateQueries({
            queryKey: currentGameKeys.all,
        });
    };
}

/** Re-reads the link and its follow status, then the game's eligibility. */
export function useCheckInstagram() {
    const sync = useSyncInstagramLink();
    return useMutation({ mutationFn: fetchLink, onSuccess: sync });
}
