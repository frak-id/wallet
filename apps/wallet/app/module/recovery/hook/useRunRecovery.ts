import { useMutation } from "@tanstack/react-query";
import type { Address, LocalAccount } from "viem";
import { isPasskeyRegisteredOnWallet } from "@/module/recovery/action/get";
import { useClaimRecoveredWallet } from "@/module/recovery/hook/useClaimRecoveredWallet";
import { useCreateRecoveryPasskey } from "@/module/recovery/hook/useCreateRecoveryPasskey";
import { usePushRecoveryPasskey } from "@/module/recovery/hook/usePushRecoveryPasskey";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * Full recovery execution: create a new passkey on this device, push it onto
 * the recovered wallet on-chain via the guardian (`doAddPasskey`), then claim
 * it on the backend (which binds it to the wallet and opens a session).
 *
 * The order matters — the backend claim only authorizes once the passkey is
 * visible on-chain, so the on-chain push must complete first. Retries resume
 * from observed state instead of local progress flags: the passkey is reused
 * from the create mutation's cached result, and the on-chain push is skipped
 * when the validator already reports the passkey on the wallet. This never
 * re-mints a passkey or re-pushes on-chain (which would orphan the first).
 */
export function useRunRecovery() {
    const { data: createdCredential, createRecoveryPasskeyAsync } =
        useCreateRecoveryPasskey();
    const { pushRecoveryPasskeyAsync } = usePushRecoveryPasskey();
    const { claimRecoveredWalletAsync } = useClaimRecoveredWallet();

    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: recoveryKey.runRecovery,
        gcTime: 0,
        mutationFn: async ({
            walletAddress,
            guardianAccount,
        }: {
            walletAddress: Address;
            guardianAccount: LocalAccount<string>;
        }) => {
            const credential =
                createdCredential ?? (await createRecoveryPasskeyAsync());

            const newPasskey = {
                authenticatorId: credential.id,
                publicKey: credential.publicKey,
            };
            const alreadyOnChain = await isPasskeyRegisteredOnWallet({
                wallet: walletAddress,
                passkey: newPasskey,
            });
            if (!alreadyOnChain) {
                await pushRecoveryPasskeyAsync({
                    walletAddress,
                    recoveryAccount: guardianAccount,
                    newPasskey,
                });
            }

            return claimRecoveredWalletAsync({
                wallet: walletAddress,
                credential,
            });
        },
    });

    return {
        ...mutationStuff,
        runRecoveryAsync: mutateAsync,
        runRecovery: mutate,
    };
}
