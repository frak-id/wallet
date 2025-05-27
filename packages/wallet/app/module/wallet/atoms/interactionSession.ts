import type { InteractionSession } from "@/types/Session";
import { noopStorage } from "@wagmi/core";
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
