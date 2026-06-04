import { useMutation } from "@tanstack/react-query";
import { useRef } from "react";
import type { Address, LocalAccount } from "viem";
import {
    type RecoveryCredential,
    useCreateRecoveryPasskey,
} from "@/module/recovery/hook/useCreateRecoveryPasskey";
import { usePerformRecovery } from "@/module/recovery/hook/usePerformRecovery";
import { useRecoveryClaim } from "@/module/recovery/hook/useRecoveryClaim";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * Full recovery execution: create a new passkey on this device, push it onto
 * the recovered wallet on-chain via the guardian (`doAddPasskey`), then claim
 * it on the backend (which binds it to the wallet and opens a session).
 *
 * The order matters — the backend claim only authorizes once the passkey is
 * visible on-chain, so the on-chain push must complete first. Each phase is
 * remembered across retries: a failed claim resumes at the claim alone, never
 * re-minting a passkey or re-pushing on-chain (which would orphan the first).
 */
export function useRunRecovery() {
    const { createRecoveryPasskeyAsync } = useCreateRecoveryPasskey();
    const { performRecoveryAsync } = usePerformRecovery();
    const { claimRecoveryAsync } = useRecoveryClaim();

    // Per-attempt progress so a retry after a failed claim skips the steps that
    // already succeeded (passkey creation + on-chain push).
    const credentialRef = useRef<RecoveryCredential | null>(null);
    const onChainDoneRef = useRef(false);

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
            if (!credentialRef.current) {
                credentialRef.current = await createRecoveryPasskeyAsync();
            }
            const credential = credentialRef.current;

            if (!onChainDoneRef.current) {
                await performRecoveryAsync({
                    walletAddress,
                    recoveryAccount: guardianAccount,
                    newPasskey: {
                        authenticatorId: credential.id,
                        publicKey: credential.publicKey,
                    },
                });
                onChainDoneRef.current = true;
            }

            return claimRecoveryAsync({ wallet: walletAddress, credential });
        },
    });

    return {
        ...mutationStuff,
        runRecoveryAsync: mutateAsync,
        runRecovery: mutate,
    };
}
