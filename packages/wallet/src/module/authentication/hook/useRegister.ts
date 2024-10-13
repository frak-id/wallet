import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { backendApi } from "@frak-labs/shared/context/server";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useSetAtom } from "jotai/index";

/**
 * Hook that handle the registration process
 */
export function useRegister(mutations?: UseMutationOptions<Session>) {
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
        ...mutations,
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
            const encodedResponse = Buffer.from(
                JSON.stringify(registrationResponse)
            ).toString("base64");
            const { data: wallet, error } =
                await backendApi.auth.wallet.register.post({
                    userAgent: navigator.userAgent,
                    expectedChallenge: registrationOptions.challenge,
                    registrationResponse: encodedResponse,
                    setSessionCookie: true,
                });
            if (error) {
                throw error;
            }

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
