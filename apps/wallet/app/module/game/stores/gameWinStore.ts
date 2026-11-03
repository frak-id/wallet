import { create } from "zustand";
import { persist } from "zustand/middleware";

type GameWinState = {
    /** Won game ids whose win screen this device already showed. */
    celebrated: Record<string, true>;
    markCelebrated: (gameId: string) => void;
};

export const gameWinStore = create<GameWinState>()(
    persist(
        (set) => ({
            celebrated: {},
            markCelebrated: (gameId) =>
                set((state) => ({
                    celebrated: { ...state.celebrated, [gameId]: true },
                })),
        }),
        {
            name: "frak_game_win_store",
            partialize: (state) => ({ celebrated: state.celebrated }),
        }
    )
);
