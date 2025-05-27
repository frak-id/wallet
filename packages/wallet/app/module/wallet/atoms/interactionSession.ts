import type { InteractionSession } from "@/types/Session";
import { atomWithStorage, createJSONStorage } from "jotai/utils";

export const interactionSessionAtom =
    atomWithStorage<InteractionSession | null>(
        "frak_interactionSession",
        null,
        createJSONStorage(() =>
            typeof window !== "undefined" ? localStorage : noopStorage
        ),
        { getOnInit: true }
    );

const noopStorage = {
    getItem: () => null,
    setItem: () => {},
    removeItem: () => {},
};
