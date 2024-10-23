import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import type { RecoveryFileContent } from "@/types/Recovery";
import { backendApi } from "@frak-labs/shared/context/server";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";

/**
 * Create a new webauthn authenticator to recover the given account
 */
export function useCreateRecoveryPasskey() {
    const { mutateAsync, mutate, ...mutationStuff } = useMutation({
        mutationKey: ["recovery", "create-passkey"],
        gcTime: 0,
        mutationFn: async ({ file }: { file: RecoveryFileContent }) => {
            // Get the registration options and start the registration
            const registrationOptions = await getRegisterOptions();
            const registrationResponse = await startRegistration({
                optionsJSON: registrationOptions,
            });

            // Verify the registration and return the formatted output
            const encodedResponse = Buffer.from(
                JSON.stringify(registrationResponse)
            ).toString("base64");
            const { data: wallet, error } =
                await backendApi.auth.wallet.register.post({
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
