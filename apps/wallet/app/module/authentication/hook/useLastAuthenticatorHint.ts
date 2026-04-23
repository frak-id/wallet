import {
    authenticationStore,
    type PreviousAuthenticatorModel,
    recoveryHintStorage,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

/**
 * Returns the best-known "last authenticator" hint for the current device.
 *
 * Sources, in priority order:
 *  1. `authenticationStore.lastAuthenticator` (Zustand, persisted via
 *     localStorage). Freshest but wiped on uninstall.
 *  2. `recoveryHintStorage` (iCloud KV on iOS, Block Store on Android).
 *     Survives uninstall — this is what unlocks the reinstall UX.
 *
 * Returns `null` when neither source has data (first launch on a new
 * Apple/Google account, or fresh install with no recovery hint written
 * yet).
 */
export function useLastAuthenticatorHint(): PreviousAuthenticatorModel | null {
    const lastAuthenticator = authenticationStore(
        (state) => state.lastAuthenticator
    );

    const { data: recoveryHint } = useQuery({
        queryKey: ["recoveryHint"],
        queryFn: () => recoveryHintStorage.get(),
        // Static across the session — the hint only changes on auth success,
        // and those paths invalidate it explicitly.
        staleTime: Number.POSITIVE_INFINITY,
        // Cloud-backed KV; excluded from the query persister so we never
        // shadow the authoritative native read with a stale cached copy.
        meta: { storable: false },
    });

    return useMemo(() => {
        if (lastAuthenticator?.authenticatorId && lastAuthenticator?.address) {
            return {
                wallet: lastAuthenticator.address,
                authenticatorId: lastAuthenticator.authenticatorId,
                transports: lastAuthenticator.transports,
            };
        }

        if (recoveryHint?.lastAuthenticatorId && recoveryHint?.lastWallet) {
            return {
                wallet: recoveryHint.lastWallet,
                authenticatorId: recoveryHint.lastAuthenticatorId,
                // Transports aren't persisted in the cross-platform hint —
                // let the OS decide (iOS: platform authenticator by default).
                transports: undefined,
            };
        }

        return null;
    }, [lastAuthenticator, recoveryHint]);
}
