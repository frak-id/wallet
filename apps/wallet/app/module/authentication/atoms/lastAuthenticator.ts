import type { Session } from "@frak-labs/wallet-shared/types/Session";
import type { WebAuthNWallet } from "@frak-labs/wallet-shared/types/WebAuthN";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { dexieDb } from "@/module/common/storage/dexie/dexieDb";

export type LastAuthentication = WebAuthNWallet;

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
    async (_get, set, authentication: Session) => {
        // Ensure that's a webauthn one
        if (
            authentication.type !== "webauthn" &&
            authentication.type !== undefined
        ) {
            return;
        }

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
