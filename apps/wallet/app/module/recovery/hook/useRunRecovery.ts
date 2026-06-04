import { useMutation } from "@tanstack/react-query";
import type { Address, LocalAccount } from "viem";
import { useCreateRecoveryPasskey } from "@/module/recovery/hook/useCreateRecoveryPasskey";
import { usePerformRecovery } from "@/module/recovery/hook/usePerformRecovery";
import { useRecoveryClaim } from "@/module/recovery/hook/useRecoveryClaim";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * Full recovery execution: create a new passkey on this device, push it onto
 * the recovered wallet on-chain via the guardian (`doAddPasskey`), then claim
 * it on the backend (which binds it to the wallet and opens a session).
 *
 * The order matters — the backend claim only authorizes once the passkey is
 * visible on-chain, so the on-chain push must complete first.
 */
export function useRunRecovery() {
    const { createRecoveryPasskeyAsync } = useCreateRecoveryPasskey();
    const { performRecoveryAsync } = usePerformRecovery();
    const { claimRecoveryAsync } = useRecoveryClaim();

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
            const credential = await createRecoveryPasskeyAsync();
            await performRecoveryAsync({
                walletAddress,
                recoveryAccount: guardianAccount,
                newPasskey: {
                    authenticatorId: credential.id,
                    publicKey: credential.publicKey,
                },
            });
            return claimRecoveryAsync({ wallet: walletAddress, credential });
        },
    });

    return {
        ...mutationStuff,
        runRecoveryAsync: mutateAsync,
        runRecovery: mutate,
    };
}
