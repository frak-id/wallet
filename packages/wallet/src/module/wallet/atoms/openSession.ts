import { atomWithStorage } from "jotai/utils";

export const openSessionAtom = atomWithStorage<{
    sessionStart: number;
    sessionEnd: number;
} | null>("sessionOpen", null);
