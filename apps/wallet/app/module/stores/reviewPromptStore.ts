import type { EventMap } from "@frak-labs/wallet-shared";
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ReviewTrigger = EventMap["store_review_requested"]["trigger"];

type ReviewPromptState = {
    launchCount: number;
    lastAskedAt: number | null;
    recordLaunch: () => void;
    markAsked: (at: number) => void;
};

export const reviewPromptStore = create<ReviewPromptState>()(
    persist(
        (set) => ({
            launchCount: 0,
            lastAskedAt: null,
            recordLaunch: () =>
                set((state) => ({ launchCount: state.launchCount + 1 })),
            markAsked: (at) => set({ lastAskedAt: at }),
        }),
        {
            name: "frak_review_prompt_store",
            partialize: (state) => ({
                launchCount: state.launchCount,
                lastAskedAt: state.lastAskedAt,
            }),
        }
    )
);
