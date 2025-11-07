import type { RecoveryFileContent } from "@frak-labs/wallet-shared";
import {
    authenticatedWalletApi,
    getRegisterOptions,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { toHex } from "viem";
import { recoveryKey } from "@/module/recovery/queryKeys/recovery";

/**
 * Create a new webauthn authenticator to recover the given account
 */
export function useCreateRecoveryPasskey() {
    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: recoveryKey.createRecoveryPasskey,
        gcTime: 0,
        mutationFn: async ({ file }: { file: RecoveryFileContent }) => {
            // Get the registration options and start the registration
            const { id, publicKey, raw } = await WebAuthnP256.createCredential(
                getRegisterOptions()
            );

            // Verify the registration and return the formatted output
            const encodedResponse = btoa(JSON.stringify(raw));
            const { data: wallet, error } =
                await authenticatedWalletApi.auth.register.post({
                    id,
                    userAgent: navigator.userAgent,
                    publicKey: {
                        x: toHex(publicKey.x),
                        y: toHex(publicKey.y),
                        prefix: publicKey.prefix,
                    },
                    raw: encodedResponse,
                    previousWallet: file.initialWallet.address,
                });
            if (error) {
                throw error;
            }

            return { wallet };
        },
    });

    return {
        ...mutationStuff,
        createRecoveryPasskeyAsync: mutateAsync,
        createRecoveryPasskey: mutate,
    };
}
