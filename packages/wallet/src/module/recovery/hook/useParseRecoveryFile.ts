import { decryptPrivateKey } from "@/module/recovery/utils/decrypt";
import type { RecoveryFileContent } from "@/types/Recovery";
import { useMutation } from "@tanstack/react-query";

/**
 * Generate the recovery file
 */
export function useParseRecoveryFile() {
    const { mutateAsync } = useMutation({
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

    return mutateAsync;
}
