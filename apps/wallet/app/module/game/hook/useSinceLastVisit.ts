import { useEffect, useMemo, useRef } from "react";
import { gameSeenStore } from "@/module/game/stores/gameSeenStore";
import {
    type GameSeen,
    gainsSince,
    NO_GAINS,
} from "@/module/game/utils/gameGains";

/**
 * What the user earned since this device last showed the game.
 * The baseline is read when the page mounts and held, so a refetch landing
 * later shows its gains; each render with data then becomes the next baseline.
 */
export function useSinceLastVisit(gameId: string | null, me?: GameSeen) {
    const held = useRef<{
        gameId: string;
        baseline: GameSeen | null;
    } | null>(null);
    const markSeen = gameSeenStore((state) => state.markSeen);
    if (gameId && held.current?.gameId !== gameId) {
        held.current = {
            gameId,
            baseline: gameSeenStore.getState().seen[gameId] ?? null,
        };
    }
    const baseline = held.current?.baseline ?? null;
    const gains = useMemo(
        () => (me ? gainsSince(baseline, me) : NO_GAINS),
        [baseline, me]
    );

    useEffect(() => {
        if (gameId && me) {
            markSeen(gameId, {
                ticketsBySource: me.ticketsBySource,
                eligible: me.eligible,
            });
        }
    }, [gameId, me, markSeen]);

    return gains;
}
