import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Address, Hex } from "viem";
import type { SdkSession, Session } from "@/types/Session";
import type { WebAuthNWallet } from "../../../types/WebAuthN";

export const sessionAtom = atomWithStorage<Session | null>(
    "frak_session",
    null
);

export const webauthnSessionAtom = atom((get) => {
    const session = get(sessionAtom);
    if (!session || (session.type !== undefined && session.type !== "webauthn"))
        return null;
    return session as WebAuthNWallet;
});

export const ecdsaSessionAtom = atom((get) => {
    const session = get(sessionAtom);
    if (!session || session.type !== "ecdsa") return null;
    return session;
});

export const distantWebauthnSessionAtom = atom((get) => {
    const session = get(sessionAtom);
    if (!session || session.type !== "distant-webauthn") return null;
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
