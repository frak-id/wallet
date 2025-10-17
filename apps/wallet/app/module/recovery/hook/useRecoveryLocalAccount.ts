import type { RecoveryFileContent } from "@frak-labs/wallet-shared/types/Recovery";
import { useMutation } from "@tanstack/react-query";
import { privateKeyToAccount } from "viem/accounts";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";
import { decryptPrivateKey } from "@/module/recovery/utils/decrypt";

/**
 * Parse the guardian private key from the recovery file
 * TODO: This should also trigger the wallet update function??
 */
export function useRecoveryLocalAccount() {
    const { mutateAsync, mutate, data, ...mutationStuff } = useMutation({
        mutationKey: recoveryKey.parseRecoveryFile,
        mutationFn: async ({
            file,
            pass,
        }: {
            file: RecoveryFileContent;
            pass: string;
        }) => {
            // Decrypt the guardian private key
            const privateKey = await decryptPrivateKey({
                pass,
                guardianPrivateKeyEncrypted: file.guardianPrivateKeyEncrypted,
            });

            // Build the recovery smart account
            return privateKeyToAccount(privateKey);
        },
    });

    return {
        ...mutationStuff,
        recoveryLocalAccount: data,
        getRecoveryLocalAccountAsync: mutateAsync,
        getRecoveryLocalAccount: mutate,
    };
}
