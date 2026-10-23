import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { frakGame } from "@/module/game/config";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";

export type InstagramLink = {
    username: string;
    /** Whether the account followed @frak_fr at `checkedAt`. */
    follows: boolean;
    checkedAt: string;
};

export const instagramKeys = {
    link: ["game", "instagram", "link"] as const,
    code: ["game", "instagram", "code"] as const,
};

// shortcut: mocked until FRA-369 ships GET /instagram, POST /instagram/code and POST /instagram/check; swap these for the API calls.
const api = {
    link: async (): Promise<InstagramLink | null> => null,
    code: async () => ({ code: "K7Q2PX" }),
};

/** The caller's linked Instagram account, `null` when none is linked. */
export function useInstagramLink() {
    return useQuery({
        queryKey: instagramKeys.link,
        queryFn: api.link,
        enabled: frakGame.enabled,
    });
}

/** One-time code the player sends to @frak_fr; it also rides on the ig.me `ref`. */
export function useInstagramLinkCode() {
    return useQuery({
        queryKey: instagramKeys.code,
        queryFn: api.code,
        enabled: frakGame.enabled,
    });
}

/** Re-reads the link and its follow status, then the game's eligibility. */
export function useCheckInstagram() {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: api.link,
        onSuccess: (link) => {
            queryClient.setQueryData(instagramKeys.link, link);
            void queryClient.invalidateQueries({
                queryKey: currentGameKeys.all,
            });
        },
    });
}
