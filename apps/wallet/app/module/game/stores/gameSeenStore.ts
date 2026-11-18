import type { GameOutcome } from "@frak-labs/backend-elysia/domain/game/schemas";
import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameSeen } from "@/module/game/utils/gameGains";

type GameSeenState = {
    /** The tickets and eligibility this device last showed, per game id. */
    seen: Record<string, GameSeen>;
    /** The outcome each ended game had when the user closed its wallet-home card; a new outcome shows it again. */
    dismissed: Record<string, GameOutcome>;
    markSeen: (gameId: string, seen: GameSeen) => void;
    dismiss: (gameId: string, outcome: GameOutcome) => void;
};

export const GAME_SEEN_STORE_NAME = "frak_game_seen_store";

export const gameSeenStore = create<GameSeenState>()(
    persist(
        (set) => ({
            seen: {},
            dismissed: {},
            markSeen: (gameId, seen) =>
                set((state) => ({ seen: { ...state.seen, [gameId]: seen } })),
            dismiss: (gameId, outcome) =>
                set((state) => ({
                    dismissed: { ...state.dismissed, [gameId]: outcome },
                })),
        }),
        {
            name: GAME_SEEN_STORE_NAME,
            partialize: (state) => ({
                seen: state.seen,
                dismissed: state.dismissed,
            }),
        }
    )
);
