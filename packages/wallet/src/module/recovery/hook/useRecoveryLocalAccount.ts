import { decryptPrivateKey } from "@/module/recovery/utils/decrypt";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useMutation } from "@tanstack/react-query";
import { privateKeyToAccount } from "viem/accounts";

/**
 * Parse the guardian private key from the recovery file
 * TODO: This should also trigger the wallet update function??
 */
export function useRecoveryLocalAccount() {
    const { mutateAsync, mutate, data, ...mutationStuff } = useMutation({
        mutationKey: ["recovery", "parse-file"],
        mutationFn: async ({
            file,
            pass,
        }: { file: RecoveryFileContent; pass: string }) => {
            // Decrypt the guardian private key
            console.log("Starting unlock");
            const privateKey = await decryptPrivateKey({
                pass,
                guardianPrivateKeyEncrypted: file.guardianPrivateKeyEncrypted,
            });
            console.log("Private key parsed", privateKey);

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
