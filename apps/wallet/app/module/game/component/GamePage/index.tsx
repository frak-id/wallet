import type { GameResult } from "@frak-labs/backend-elysia/domain/game/schemas";
import { EmptyState } from "@frak-labs/design-system/components/EmptyState";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { trackEvent } from "@frak-labs/wallet-shared";
import { Navigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { Back } from "@/module/common/component/Back";
import { Title } from "@/module/common/component/Title";
import { OpenGameCard } from "@/module/game/component/GameCard";
import { GameHero } from "@/module/game/component/GameHero";
import { GameMissions } from "@/module/game/component/GameMissions";
import { PastGames } from "@/module/game/component/GameResult";
import { GameResultView } from "@/module/game/component/GameResultView";
import { useCurrentGame } from "@/module/game/hook/useCurrentGame";
import { useGameHistory } from "@/module/game/hook/useGameHistory";
import { useSinceLastVisit } from "@/module/game/hook/useSinceLastVisit";
import { formatGameAmount } from "@/module/game/utils/formatGameAmount";
import { missionsDone, missionsOf } from "@/module/game/utils/gameMissions";
import { recordOf } from "@/module/game/utils/gameRecord";
import { useRefreshInstagramFollow } from "@/module/instagram/hook/useInstagramLink";

/** Past the end, the backend has closed the game: reload a little after. */
const END_GRACE_MS = 5_000;
/** setTimeout fires at once beyond 2^31 - 1 ms; a page open that long refetches on its own. */
const MAX_TIMEOUT_MS = 2_147_483_647;

type CurrentGame = NonNullable<ReturnType<typeof useCurrentGame>["data"]>;

type OpenGame = NonNullable<CurrentGame["game"]>;

/** What tops the page: the open game, or the last result once none is open. */
type Top =
    | { kind: "error" | "loading" | "none" }
    | { kind: "result"; result: GameResult }
    | { kind: "join" | "playing"; game: OpenGame };

/** Cached data wins over a failed refetch: the error shows only when there is nothing to show. */
function topOf(
    current: ReturnType<typeof useCurrentGame>,
    history: ReturnType<typeof useGameHistory>
): Top {
    const data = current.data;
    if (!data) return { kind: current.isError ? "error" : "loading" };
    // History first even when playing: a draw waiting on the user tops the page.
    if (history.isLoading) return { kind: "loading" };
    if (data.game && data.me.participating) {
        return { kind: "playing", game: data.game };
    }
    if (data.game) return { kind: "join", game: data.game };
    const latest = history.data?.[0];
    if (latest) return { kind: "result", result: latest };
    return { kind: history.isError ? "error" : "none" };
}

export function GamePage() {
    const { t, i18n } = useTranslation();
    useRefreshInstagramFollow();
    const current = useCurrentGame();
    const history = useGameHistory();
    useReloadAtEnd(
        current.data?.game?.endsAt,
        current.refetch,
        history.refetch
    );
    const game = current.data?.game;
    const me = current.data?.me;
    const viewedGameId = game && me?.participating ? game.id : null;
    const trackedGameId = useRef<string | null>(null);
    const top = topOf(current, history);
    const results = history.data ?? [];
    const resultShown = top.kind === "result" ? top.result : null;
    const pending = results.find(
        (result) => result.outcome === "pending_verification"
    );
    const trackedResultIds = useRef(new Set<string>());
    const gains = useSinceLastVisit(viewedGameId, me);
    const progressTracked = useRef(false);

    useEffect(() => {
        for (const result of [pending, resultShown]) {
            if (!result || trackedResultIds.current.has(result.game.id)) {
                continue;
            }
            trackedResultIds.current.add(result.game.id);
            trackEvent("game_result_viewed", {
                game_id: result.game.id,
                outcome: result.outcome,
                record: recordOf(result, history.data ?? []).kind,
            });
        }
    }, [pending, resultShown, history.data]);

    // Once per game shown: a refetch with new counts is not a new view.
    useEffect(() => {
        if (!(viewedGameId && me) || trackedGameId.current === viewedGameId) {
            return;
        }
        trackedGameId.current = viewedGameId;
        trackEvent("game_page_viewed", {
            tickets: me.tickets,
            eligible: me.eligible,
            instagram: me.instagram,
            missions_done: missionsDone(missionsOf(me)),
            tickets_join: me.ticketsBySource.join,
            tickets_instagram_certified: me.ticketsBySource.instagramCertified,
            tickets_purchase: me.ticketsBySource.purchase,
            tickets_referred_purchase: me.ticketsBySource.referredPurchase,
            tickets_referred_signup: me.ticketsBySource.referredSignup,
            tickets_brand_share: me.ticketsBySource.brandShare,
        });
    }, [viewedGameId, me]);

    useEffect(() => {
        if (progressTracked.current || !(gains.total > 0 || gains.unlocked)) {
            return;
        }
        progressTracked.current = true;
        trackEvent("game_progress_shown", {
            tickets_gained: gains.total,
            unlocked: gains.unlocked,
        });
    }, [gains]);

    // With past games to show, a user not in the open game still gets the page.
    if (top.kind === "join" && results.length === 0) {
        return <Navigate to="/game/join" replace />;
    }

    return (
        <Stack space="m">
            <Back href="/wallet" />
            <Title size="page">{t("game.page.title")}</Title>
            {top.kind === "error" && (
                <EmptyState
                    title={t("game.page.error")}
                    action={{
                        label: t("game.page.retry"),
                        onClick: () => {
                            void current.refetch();
                            void history.refetch();
                        },
                    }}
                />
            )}
            {top.kind === "loading" && <Skeleton variant="rect" height={160} />}
            {pending && pending !== resultShown && (
                <GameResultView result={pending} history={results} />
            )}
            {top.kind === "none" && (
                <EmptyState
                    title={t("game.page.none.title")}
                    description={t("game.page.none.description")}
                />
            )}
            {top.kind === "join" && me && (
                <OpenGameCard game={top.game} me={me} />
            )}
            {top.kind === "result" && (
                <GameResultView result={top.result} history={results} />
            )}
            {top.kind === "playing" && me && (
                <>
                    <GameHero
                        me={me}
                        prize={
                            top.game.prizeDescription ??
                            formatGameAmount(
                                top.game.prizeAmount,
                                i18n.language
                            )
                        }
                        endsAt={top.game.endsAt}
                        gains={gains}
                    />
                    <GameMissions missions={missionsOf(me)} />
                </>
            )}
            {top.kind !== "loading" && (
                <PastGames
                    results={results.filter(
                        (result) => result !== resultShown && result !== pending
                    )}
                />
            )}
        </Stack>
    );
}

function useReloadAtEnd(
    endsAt: Date | string | undefined,
    refetchCurrent: () => Promise<unknown>,
    refetchHistory: () => Promise<unknown>
) {
    const end = endsAt ? new Date(endsAt).getTime() : null;
    useEffect(() => {
        if (end === null) return;
        const delay = Math.max(0, end - Date.now() + END_GRACE_MS);
        if (delay > MAX_TIMEOUT_MS) return;
        // History first: a closed game over a stale history would show the previous result.
        const id = setTimeout(() => {
            void refetchHistory().then(() => refetchCurrent());
        }, delay);
        return () => clearTimeout(id);
    }, [end, refetchCurrent, refetchHistory]);
}
