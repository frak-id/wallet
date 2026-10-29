import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { GameSeen } from "@/module/game/utils/gameGains";

type GameSeenState = {
    /** The tickets and eligibility this device last showed, per game id. */
    seen: Record<string, GameSeen>;
    markSeen: (gameId: string, seen: GameSeen) => void;
};

export const GAME_SEEN_STORE_NAME = "frak_game_seen_store";

export const gameSeenStore = create<GameSeenState>()(
    persist(
        (set) => ({
            seen: {},
            markSeen: (gameId, seen) =>
                set((state) => ({ seen: { ...state.seen, [gameId]: seen } })),
        }),
        {
            name: GAME_SEEN_STORE_NAME,
            partialize: (state) => ({ seen: state.seen }),
        }
    )
);
