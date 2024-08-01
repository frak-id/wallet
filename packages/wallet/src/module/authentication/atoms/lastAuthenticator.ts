import { dexieDb } from "@/context/common/dexie/dexieDb";
import type { Session } from "@/types/Session";
import type { AuthenticatorTransportFuture } from "@simplewebauthn/types";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

type LastAuthentication = Session & {
    transports?: AuthenticatorTransportFuture[];
};

/**
 * Atom with our last authenticator
 */
const lastAuthenticatorAtom = atomWithStorage<LastAuthentication | null>(
    "lastAuthentication",
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
            wallet: authentication.wallet.address,
            authenticatorId: authentication.wallet.authenticatorId,
            transports: authentication.transports,
        });
    }
);
