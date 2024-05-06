import { validateRegistration } from "@/context/wallet/action/register";
import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { sessionAtom } from "@/module/common/atoms/session";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai/index";

/**
 * Hook that handle the registration process
 */
export function useRegister() {
    // Setter for the session
    const setSession = useSetAtom(sessionAtom);

    // Setter for the last authentication
    const addLastAuthentication = useSetAtom(addLastAuthenticationAtom);
    const { data: previousAuthenticators } = usePreviousAuthenticators();

    /**
     * Mutation used to launch the registration process
     */
    const {
        isPending: isRegisterInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync: register,
    } = useMutation({
        mutationKey: ["register"],
        mutationFn: async () => {
            // Build the credentials to exclude
            const excludeCredentials = previousAuthenticators?.map(
                (auth) =>
                    ({
                        id: auth.authenticatorId,
                        transports: auth.transports,
                    }) as const
            );

            // Get the registration options
            const registrationOptions = await getRegisterOptions({
                excludeCredentials,
            });

            // Start the registration
            const registrationResponse =
                await startRegistration(registrationOptions);

            // Verify it
            const { wallet } = await validateRegistration({
                expectedChallenge: registrationOptions.challenge,
                registrationResponse,
                userAgent: navigator.userAgent,
            });

            // Save this to the last authenticator
            await addLastAuthentication({
                wallet,
                transports: registrationResponse.response.transports,
            });

            // Set the session
            setSession({ wallet });

            return { wallet };
        },
    });

    return {
        isRegisterInProgress,
        isSuccess,
        isError,
        error,
        register,
    };
}
