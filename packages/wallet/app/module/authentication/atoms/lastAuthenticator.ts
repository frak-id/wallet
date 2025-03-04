import { dexieDb } from "@/module/common/storage/dexie/dexieDb";
import type { P256PubKey, WebAuthNWallet } from "@/types/WebAuthN";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/browser";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { Address } from "viem";

type LastAuthentication = Omit<WebAuthNWallet, "publicKey"> & {
    publicKey: P256PubKey | Readonly<Address>;
    transports?: AuthenticatorTransportFuture[];
};

/**
 * Atom with our last authenticator
 */
export const lastAuthenticatorAtom = atomWithStorage<LastAuthentication | null>(
    "frak_lastAuthentication",
    null
);

/**
 * Atom used to add a last authenticator
 */
export const addLastAuthenticationAtom = atom(
    null,
    async (_get, set, authentication: LastAuthentication) => {
        // Define it as last authentication
        set(lastAuthenticatorAtom, authentication);

        // Add it to the last authentications
        await dexieDb.previousAuthenticator.put({
            wallet: authentication.address,
            authenticatorId: authentication.authenticatorId,
            transports: authentication.transports,
        });
    }
);
