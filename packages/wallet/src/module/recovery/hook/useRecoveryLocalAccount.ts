import { decryptPrivateKey } from "@/module/recovery/utils/decrypt";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useMutation } from "@tanstack/react-query";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Parse the guardian private key from the recovery file
 * TODO: This should also trigger the wallet update function??
 */
export function useRecoveryLocalAccount() {
    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: ["recovery", "parse-file"],
        gcTime: 0,
        mutationFn: async ({
            file,
            pass,
        }: { file: RecoveryFileContent; pass: string }) => {
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
        getRecoveryLocalAccountAsync: mutateAsync,
        getRecoveryLocalAccount: mutate,
    };
}
