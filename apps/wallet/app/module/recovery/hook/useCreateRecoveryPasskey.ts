import type { RecoveryFileContent } from "@frak-labs/wallet-shared/types/Recovery";
import { getRegisterOptions } from "@frak-labs/wallet-shared/wallet/action/registerOptions";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
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
            const registrationOptions = await getRegisterOptions();
            const registrationResponse = await startRegistration({
                optionsJSON: registrationOptions,
            });

            // Verify the registration and return the formatted output
            const encodedResponse = btoa(JSON.stringify(registrationResponse));
            const { data: wallet, error } =
                await authenticatedWalletApi.auth.register.post({
                    userAgent: navigator.userAgent,
                    expectedChallenge: registrationOptions.challenge,
                    registrationResponse: encodedResponse,
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
