import type { SdkSession, Session } from "@/types/Session";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export const sessionAtom = atomWithStorage<Session | null>(
    "frak_session",
    null
);

export const webauthnSessionAtom = atom((get) => {
    const session = get(sessionAtom);
    if (!session || typeof session.publicKey !== "object") return null;
    return session;
});

export const ecdsaSessionAtom = atom((get) => {
    const session = get(sessionAtom);
    if (!session || typeof session.publicKey === "object") return null;
    return session;
});

export const sdkSessionAtom = atomWithStorage<SdkSession | null>(
    "frak_sdkSession",
    null
);

export const privateKeyAtom = atomWithStorage<string | null>(
    "frak_privateKey",
    null
);
