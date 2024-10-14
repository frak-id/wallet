import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { backendApi } from "@frak-labs/shared/context/server";
import { jotaiStore } from "@module/atoms/store";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";

/**
 * Hook that handle the registration process
 */
export function useRegister(mutations?: UseMutationOptions<Session>) {
    // Setter for the last authentication
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
            const { data, error } = await backendApi.auth.wallet.register.post({
                userAgent: navigator.userAgent,
                expectedChallenge: registrationOptions.challenge,
                registrationResponse: encodedResponse,
                setSessionCookie: true,
            });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { sdkJwt, ...session } = data;

            // Save this to the last authenticator
            await jotaiStore.set(addLastAuthenticationAtom, {
                transports: registrationResponse.response.transports,
                ...session,
            });

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            return session;
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
