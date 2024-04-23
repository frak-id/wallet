import { validateRegistration } from "@/context/wallet/action/register";
import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import type { RecoveryFileContent } from "@/types/Recovery";
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
            const registrationResponse =
                await startRegistration(registrationOptions);

            // Verify the registration and return the formatted output
            return validateRegistration({
                expectedChallenge: registrationOptions.challenge,
                registrationResponse,
                userAgent: navigator.userAgent,
                previousWallet: file.initialWallet.address,
                setCookieSession: false,
            });
        },
    });

    return {
        ...mutationStuff,
        createRecoveryPasskeyAsync: mutateAsync,
        createRecoveryPasskey: mutate,
    };
}
