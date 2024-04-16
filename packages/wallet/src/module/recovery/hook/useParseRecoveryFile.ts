import { decryptPrivateKey } from "@/module/recovery/utils/decrypt";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useMutation } from "@tanstack/react-query";

/**
 * Parse the guardian private key from the recovery file
 * TODO: This should also trigger the wallet update function??
 */
export function useParseRecoveryFile() {
    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: ["recovery", "parse-file"],
        gcTime: 0,
        mutationFn: async ({
            file,
            pass,
        }: { file: RecoveryFileContent; pass: string }) =>
            decryptPrivateKey({
                pass,
                guardianPrivateKeyEncrypted: file.guardianPrivateKeyEncrypted,
            }),
    });

    return {
        ...mutationStuff,
        parseRecoveryFileAsync: mutateAsync,
        parseRecoveryFile: mutate,
    };
}
