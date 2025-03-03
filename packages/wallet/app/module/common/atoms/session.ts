import type { SdkSession, Session } from "@/types/Session";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Address, Hex } from "viem";

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

/**
 * Private key used in the demo mode
 */
export const demoPrivateKeyAtom = atomWithStorage<Hex | null>(
    "frak_demoPrivateKey",
    null
);

export type SdkSessionPayload = {
    address: Address;
    scopes: string[];
    additionalData: {
        demoPkey: Hex;
    };
};
