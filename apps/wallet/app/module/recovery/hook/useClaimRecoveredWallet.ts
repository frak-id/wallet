import {
    addLastAuthentication,
    authenticatedWalletApi,
    type Session,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Address } from "viem";
import type { RecoveryCredential } from "@/module/recovery/hook/useCreateRecoveryPasskey";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";

/**
 * Register the new passkey against the recovered wallet on the backend and
 * open a session for it.
 *
 * Calls `/auth/recover` (not `/auth/register`): the backend authorizes the
 * bind by reading the passkey back from the validator on-chain, so this must
 * run AFTER `doAddPasskey` has landed. On success the minted session is the
 * recovered wallet's, and we persist it so the user is logged straight in.
 */
export function useClaimRecoveredWallet() {
    const queryClient = useQueryClient();

    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: recoveryKey.claimRecovery,
        gcTime: 0,
        mutationFn: async ({
            wallet,
            credential,
        }: {
            wallet: Address;
            credential: RecoveryCredential;
        }) => {
            const { data, error } =
                await authenticatedWalletApi.auth.recover.post({
                    id: credential.id,
                    publicKey: credential.publicKey,
                    raw: credential.raw,
                    userAgent: navigator.userAgent,
                    wallet,
                });
            if (error) {
                throw error;
            }

            // Persist the freshly minted session so the recovered wallet is now
            // the active one (mirrors the tail of `useLogin`).
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;
            await addLastAuthentication(session);
            sessionStore.getState().setSession(session);
            sessionStore.getState().setSdkSession(sdkJwt);

            return session;
        },
        onSuccess: async () => {
            // The active identity just changed wallets — every cached recovery
            // read (backend blob status, on-chain option) belongs to the
            // previous session and must be refetched.
            await Promise.all([
                queryClient.invalidateQueries({ queryKey: recoveryKey.all }),
                queryClient.invalidateQueries({
                    queryKey: recoverySetupKey.all,
                }),
            ]);
        },
    });

    return {
        ...mutationStuff,
        claimRecoveredWalletAsync: mutateAsync,
        claimRecoveredWallet: mutate,
    };
}
