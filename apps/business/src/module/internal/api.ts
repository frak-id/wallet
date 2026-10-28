import type {
    DrawRejectionReason,
    GameStatus,
} from "@frak-labs/backend-elysia/domain/game/schemas";
import type {
    CreateGameInput,
    PublishSignupRuleInput,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import {
    queryOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";

const api = () => authenticatedBackendApi.internal;

/** Eden's `{ data, error }`, thrown as the error itself so callers can read its typed body. */
function unwrap<T>({ data, error }: { data: T | null; error: unknown }): T {
    if (error) throw error;
    if (data === null) throw new Error("Empty response");
    return data;
}

export const internalKeys = {
    all: ["internal"] as const,
    codes: ["internal", "codes"] as const,
    game: ["internal", "game"] as const,
    setup: ["internal", "game", "setup"] as const,
    games: ["internal", "game", "list"] as const,
    gameDetail: (gameId: string) => ["internal", "game", gameId] as const,
    players: (gameId: string) =>
        ["internal", "game", gameId, "players"] as const,
    draw: (gameId: string) => ["internal", "game", gameId, "draw"] as const,
    verify: (gameId: string) => ["internal", "game", gameId, "verify"] as const,
    lookup: (query: string) => ["internal", "lookup", query] as const,
};

/** How often the live player count refreshes; the backend serves one count for 30 s. */
export const LIVE_REFRESH_MS = 30_000;

export const frakCodesQueryOptions = () =>
    queryOptions({
        queryKey: internalKeys.codes,
        queryFn: async () => unwrap(await api()["referral-codes"].get()).codes,
    });

export const gameSetupQueryOptions = () =>
    queryOptions({
        queryKey: internalKeys.setup,
        queryFn: async () => unwrap(await api().game.setup.get()),
    });

export const gamesQueryOptions = () =>
    queryOptions({
        queryKey: internalKeys.games,
        queryFn: async () => unwrap(await api().game.get()).games,
        refetchInterval: LIVE_REFRESH_MS,
    });

export const gamePlayersQueryOptions = (gameId: string) =>
    queryOptions({
        queryKey: internalKeys.players(gameId),
        queryFn: async () =>
            unwrap(await api().game({ gameId }).players.get({ query: {} })),
        refetchInterval: LIVE_REFRESH_MS,
    });

/** Recounts now instead of reading the backend's 30 s cache. */
export function useRefreshPlayers(gameId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async () =>
            unwrap(
                await api()
                    .game({ gameId })
                    .players.get({ query: { fresh: true } })
            ),
        onSuccess: (players) =>
            queryClient.setQueryData(internalKeys.players(gameId), players),
    });
}

/** Anyone can replay the draw from this record, without trusting Frak. */
export function publicDrawUrl(gameId: string): string {
    const backendUrl = process.env.BACKEND_URL ?? "https://localhost:3030";
    return `${backendUrl}/common/game/${gameId}/draw`;
}

/** Not polled: a drawn draw re-reads the candidate's follow from Meta on every fetch. */
export const gameDrawQueryOptions = (gameId: string) =>
    queryOptions({
        queryKey: internalKeys.draw(gameId),
        queryFn: async () =>
            unwrap(await api().game({ gameId }).draw.get()).draw,
        staleTime: Number.POSITIVE_INFINITY,
    });

export const drawVerificationQueryOptions = (gameId: string) =>
    queryOptions({
        queryKey: internalKeys.verify(gameId),
        queryFn: async () =>
            unwrap(await api().game({ gameId }).draw.verify.get()).checks,
        staleTime: Number.POSITIVE_INFINITY,
    });

export const identityLookupQueryOptions = (query: string) =>
    queryOptions({
        queryKey: internalKeys.lookup(query),
        queryFn: async () => unwrap(await api().lookup.post({ q: query })),
        enabled: query.length > 0,
        retry: false,
    });

function useInvalidating<TInput, TOutput>(
    mutationFn: (input: TInput) => Promise<TOutput>,
    invalidate: (input: TInput) => readonly (readonly unknown[])[]
) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn,
        onSettled: (_data, _error, input) =>
            Promise.all(
                invalidate(input).map((queryKey) =>
                    queryClient.invalidateQueries({ queryKey })
                )
            ),
    });
}

export function useIssueFrakCode() {
    return useInvalidating(
        async (code?: string) =>
            unwrap(await api()["referral-codes"].post({ code })),
        () => [internalKeys.codes]
    );
}

export function useRevokeFrakCode() {
    return useInvalidating(
        async (code: string) =>
            unwrap(await api()["referral-codes"]({ code }).revoke.post()),
        () => [internalKeys.codes, internalKeys.games]
    );
}

export function useSeedFrakMerchant() {
    return useInvalidating(
        async (body: { domain: string; owner?: string }) =>
            unwrap(await api().game.setup.merchant.post(body)),
        () => [internalKeys.setup]
    );
}

export function usePublishSignupRule() {
    return useInvalidating(
        async (body: PublishSignupRuleInput) =>
            unwrap(await api().game.setup["signup-rule"].post(body)),
        () => [internalKeys.setup]
    );
}

export function useCreateGame() {
    return useInvalidating(
        async (body: CreateGameInput) => unwrap(await api().game.post(body)),
        () => [internalKeys.games, internalKeys.codes]
    );
}

export function useSetGameStatus(gameId: string) {
    return useInvalidating(
        async (status: GameStatus) =>
            unwrap(await api().game({ gameId }).status.post({ status })),
        () => [internalKeys.games]
    );
}

export function useRunDraws() {
    return useInvalidating(
        async () => unwrap(await api().game["run-draws"].post()),
        () => [internalKeys.game]
    );
}

export function useFreezeDraw(gameId: string) {
    return useInvalidating(
        async () => unwrap(await api().game({ gameId }).draw.freeze.post()),
        () => [internalKeys.gameDetail(gameId), internalKeys.games]
    );
}

export function useRejectCandidate(gameId: string) {
    return useInvalidating(
        async (reason: DrawRejectionReason) =>
            unwrap(await api().game({ gameId }).draw.reject.post({ reason })),
        () => [internalKeys.gameDetail(gameId), internalKeys.games]
    );
}

export function useConfirmWinner(gameId: string) {
    return useInvalidating(
        async () => unwrap(await api().game({ gameId }).draw.confirm.post()),
        () => [internalKeys.gameDetail(gameId), internalKeys.games]
    );
}

export function useGenerateSetupCode() {
    return useMutation({
        mutationFn: async (body: { domain: string; owner: string }) =>
            unwrap(await api()["setup-code"].post(body)),
    });
}
