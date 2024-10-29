import type { SdkSession, Session } from "@/types/Session";
import { atomWithStorage } from "jotai/utils";

export const sessionAtom = atomWithStorage<Session | null>(
    "frak_session",
    null
);

export const sdkSessionAtom = atomWithStorage<SdkSession | null>(
    "frak_sdkSession",
    null
);
