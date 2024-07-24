import { atom } from "jotai";

export const openSessionAtom = atom<{
    sessionStart: number;
    sessionEnd: number;
} | null>(null);
