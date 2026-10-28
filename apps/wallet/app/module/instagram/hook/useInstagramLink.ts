import {
    authenticatedWalletApi,
    balanceKey,
    claimableKey,
    getErrorCode,
    rewardsKey,
} from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { currentGameKeys } from "@/module/game/hook/useCurrentGame";
import { gameHistoryKeys } from "@/module/game/hook/useGameHistory";
import { instagramLink } from "@/module/instagram/config";

export const instagramKeys = {
    status: ["instagram", "status"] as const,
    code: ["instagram", "code"] as const,
    recheck: ["instagram", "recheck"] as const,
};

async function fetchStatus() {
    const { data, error } = await authenticatedWalletApi.instagram.get();
    if (error) throw error;
    return data;
}

async function postCheck() {
    const { data, error } = await authenticatedWalletApi.instagram.check.post();
    if (error) throw error;
    return data;
}

/** Both levels as the backend reports them; the IGSID never reaches the wallet. */
type InstagramStatus = Awaited<ReturnType<typeof fetchStatus>>;
export type InstagramLink = NonNullable<InstagramStatus["link"]>;
export type InstagramDeclaration = NonNullable<InstagramStatus["declaration"]>;

/** The caller's certified link and declared handle, each `null` when absent. */
export function useInstagramStatus() {
    return useQuery({
        queryKey: instagramKeys.status,
        queryFn: fetchStatus,
        enabled: instagramLink.enabled,
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
        enabled: instagramLink.enabled,
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
function useSyncInstagramStatus() {
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
    return useMutation({ mutationFn: postCheck, onSuccess: sync });
}

/** Matches the backend's cooldown: a check inside it would only return the stored status. */
const RECHECK_STALE_MS = 30_000;

/** An unfollow happens in Instagram, so a certified player's follow is re-read when a page showing it opens or regains focus. */
export function useRefreshInstagramFollow() {
    const queryClient = useQueryClient();
    const sync = useSyncInstagramStatus();
    const { data: status } = useInstagramStatus();
    useQuery({
        queryKey: instagramKeys.recheck,
        queryFn: async () => {
            // A status read already in flight predates the check and would overwrite its answer.
            await queryClient.cancelQueries({ queryKey: instagramKeys.status });
            const before = queryClient.getQueryData<InstagramStatus>(
                instagramKeys.status
            );
            const next = await postCheck();
            // `follows` is a boolean whenever a link exists, so this also catches a link appearing or vanishing.
            if (before?.link?.follows === next.link?.follows) {
                queryClient.setQueryData(instagramKeys.status, next);
            } else {
                sync(next);
            }
            return next;
        },
        enabled: instagramLink.enabled && Boolean(status?.link),
        staleTime: RECHECK_STALE_MS,
        retry: false,
    });
}

export const DM_POLL_INTERVAL_MS = 3_000;
export const DM_POLL_TIMEOUT_MS = 60_000;

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Meta can deliver the DM seconds after the player is back, so "sent" keeps re-reading the status until the link lands. */
export function useAwaitInstagramDm() {
    const sync = useSyncInstagramStatus();
    return useMutation({
        mutationFn: async () => {
            const deadline = Date.now() + DM_POLL_TIMEOUT_MS;
            let status = await postCheck();
            while (!status.link && Date.now() < deadline) {
                await wait(DM_POLL_INTERVAL_MS);
                status = await fetchStatus();
            }
            return status;
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
