import {
    authKey,
    type Session,
    sessionStore,
    useLogin,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import type { Address } from "viem";

type UseSwitchAuthenticatorArgs = {
    wallet: Address;
    authenticatorId: string;
    transports?: AuthenticatorTransport[];
};

/**
 * Temporarily switches the live wallet session to a different credential so
 * the merge flow can sign the winner-side `addPassKey` userOp from the
 * winner's smart account context.
 *
 * The session is **parked** rather than overwritten:
 *  - `pushSession()` saves the current `{ session, sdkSession }` into the
 *    persisted `previousSession` slot — so a tab refresh mid-flow doesn't
 *    lose the restore target.
 *  - `useLogin({ lastAuthentication })` writes the swapped-in winner
 *    session in its place.
 *  - On any failure (biometric cancel, mismatched credential, network), the
 *    snapshot is popped back so the user lands on their original session.
 *
 * Re-entry safe: if a previous attempt already pushed the snapshot, we skip
 * the push and just retry the login, leaving the snapshot intact for the
 * eventual `popSession()` at the end of the merge.
 */
export function useSwitchAuthenticator() {
    const { login } = useLogin();

    return useMutation<Session, Error, UseSwitchAuthenticatorArgs>({
        mutationKey: authKey.merge.switchAuthenticator,
        gcTime: 0,
        mutationFn: async ({ wallet, authenticatorId, transports }) => {
            const { previousSession } = sessionStore.getState();
            const didPushThisCall = previousSession === null;
            if (didPushThisCall) {
                const ok = sessionStore.getState().pushSession();
                if (!ok) {
                    throw new Error("MERGE_SWITCH_PUSH_FAILED");
                }
            }
            try {
                return await login({
                    lastAuthentication: {
                        wallet,
                        authenticatorId,
                        transports,
                    },
                });
            } catch (error) {
                // Only roll back the snapshot we just took. If the snapshot
                // pre-existed (retry after a partial failure), keep it in
                // place so the caller can retry without re-parking.
                if (didPushThisCall) {
                    sessionStore.getState().popSession();
                }
                throw error;
            }
        },
    });
}
