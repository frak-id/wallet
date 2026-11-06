import { useMemo } from "react";
import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { LANGS, type Lang } from "@/i18n";
import { isStepId, STEP_IDS, type StepId, stepIndex } from "./stepIds";
import { useOwnStep } from "./stepScope";

const FRAME_MODES = ["auto", "on", "off"] as const;
export type FrameMode = (typeof FRAME_MODES)[number];

function oneOf<T extends string>(
    allowed: readonly T[],
    value: unknown,
    fallback: T
): T {
    return allowed.find((item) => item === value) ?? fallback;
}

type DemoState = {
    stepId: StepId;
    /** Playback direction of the last move, read by the transitions. */
    direction: 1 | -1;
    lang: Lang;
    frame: FrameMode;
    goTo: (stepId: StepId) => void;
    next: () => void;
    prev: () => void;
    restart: () => void;
    setLang: (lang: Lang) => void;
    setFrame: (frame: FrameMode) => void;
};

export const useDemoStore = create<DemoState>()(
    persist(
        (set, get) => ({
            stepId: "home",
            direction: 1,
            lang: "fr",
            frame: "auto",
            goTo: (stepId) =>
                set({
                    stepId,
                    direction:
                        stepIndex(stepId) >= stepIndex(get().stepId) ? 1 : -1,
                }),
            next: () => {
                const index = stepIndex(get().stepId);
                const target = STEP_IDS[index + 1];
                if (target) set({ stepId: target, direction: 1 });
            },
            prev: () => {
                const index = stepIndex(get().stepId);
                const target = STEP_IDS[index - 1];
                if (target) set({ stepId: target, direction: -1 });
            },
            restart: () => set({ stepId: "home", direction: -1 }),
            setLang: (lang) => set({ lang }),
            setFrame: (frame) => set({ frame }),
        }),
        {
            name: "frak-referral-demo",
            version: 1,
            storage: createJSONStorage(() => localStorage),
            partialize: (s) => ({
                stepId: s.stepId,
                lang: s.lang,
                frame: s.frame,
            }),
            // An installed PWA has no easy "clear storage": never trust what was saved.
            merge: (persisted, current) => {
                const saved = (persisted ?? {}) as Partial<DemoState>;
                return {
                    ...current,
                    stepId: isStepId(saved.stepId) ? saved.stepId : "home",
                    lang: oneOf(LANGS, saved.lang, current.lang),
                    frame: oneOf(FRAME_MODES, saved.frame, current.frame),
                };
            },
        }
    )
);

/**
 * What a screen needs to move the story forward. Inside a step, moves are
 * dropped once the story has left it, so a screen still animating out (a
 * second tap, a late timer) can never advance the step that replaced it.
 */
export function useDemoNav() {
    const ownStep = useOwnStep();
    return useMemo(() => {
        const { next, prev, goTo } = useDemoStore.getState();
        const isLive = () =>
            ownStep === null || useDemoStore.getState().stepId === ownStep;
        return {
            next: () => isLive() && next(),
            prev: () => isLive() && prev(),
            goTo: (stepId: StepId) => isLive() && goTo(stepId),
        };
    }, [ownStep]);
}
