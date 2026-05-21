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
 * Temporarily swaps the live wallet session to a different credential so the
 * merge flow can sign the winner-side `addPassKey` userOp from the winner's
 * smart-account context.
 *
 * Atomic swap: the previous session is held in a local JS variable while
 * `useLogin` overwrites the live session slot with the winner. Only **after**
 * the login resolves do we write the snapshot into `previousSession` via
 * `parkSession`. Observers therefore see a single transition (loser → winner)
 * with no intermediate null — components that gate on `session?.authenticatorId`
 * never flicker to their unauthenticated branch.
 *
 * Failure rollback is implicit: if `login` throws, the snapshot is still only
 * in JS scope and the live session is unchanged. Nothing to undo. We only
 * `popSession` on retry when an earlier successful call already parked a
 * snapshot — that flag is the presence check on `previousSession`.
 */
export function useSwitchAuthenticator() {
    const { login } = useLogin();

    return useMutation<Session, Error, UseSwitchAuthenticatorArgs>({
        mutationKey: authKey.merge.switchAuthenticator,
        gcTime: 0,
        mutationFn: async ({ wallet, authenticatorId, transports }) => {
            const current = sessionStore.getState();
            if (!current.session) {
                throw new Error("MERGE_SWITCH_NO_SESSION");
            }
            const snapshot = {
                session: current.session,
                sdkSession: current.sdkSession,
            };

            const next = await login({
                lastAuthentication: {
                    wallet,
                    authenticatorId,
                    transports,
                },
            });

            // Login wrote the winner into the live slot. Park the snapshot
            // now that the swap is complete. Skip the park when an earlier
            // attempt already parked (re-entry after a partial failure) so
            // we don't lose the original target.
            const { previousSession } = sessionStore.getState();
            if (!previousSession) {
                sessionStore.getState().parkSession(snapshot);
            }

            return next;
        },
    });
}
