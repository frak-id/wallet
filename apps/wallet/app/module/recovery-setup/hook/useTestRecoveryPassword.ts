import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { recoverySetupKey } from "@/module/recovery-setup/queryKeys/recovery-setup";
import { decodeRecoveryBlob } from "@/module/recovery-setup/utils/recoveryBlob";

/**
 * Verify a password against the stored backup entirely on-device: fetch the
 * ciphertext, then attempt to decrypt it. The password never reaches the backend.
 */
export function useTestRecoveryPassword() {
    const { mutate, mutateAsync, ...mutationStuff } = useMutation({
        mutationKey: recoverySetupKey.testPassword,
        gcTime: 0,
        mutationFn: async ({
            password,
        }: {
            password: string;
        }): Promise<boolean> => {
            const { data, error } =
                await authenticatedWalletApi.auth.recovery.blob.get();
            if (error) throw error;
            if (!data.blob) return false;

            const decoded = await decodeRecoveryBlob({
                blob: data.blob,
                password,
            });
            return decoded !== null;
        },
    });

    return {
        ...mutationStuff,
        testPassword: mutate,
        testPasswordAsync: mutateAsync,
    };
}
