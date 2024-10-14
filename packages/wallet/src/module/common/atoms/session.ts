import type { Session } from "@/types/Session";
import { atomWithStorage } from "jotai/utils";

export const sessionAtom = atomWithStorage<Session | null>("session", null);

export const sdkSessionAtom = atomWithStorage<{
    token: string;
    expires: number;
} | null>("sdkSession", null);
