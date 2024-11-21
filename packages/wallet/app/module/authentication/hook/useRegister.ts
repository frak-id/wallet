import { authenticatedBackendApi } from "@/context/common/backendClient";
import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { jotaiStore } from "@module/atoms/store";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * Hook that handle the registration process
 */
export function useRegister(
    options?: UseMutationOptions<Session> & { ssoId?: Hex }
) {
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
        ...options,
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
            const registrationResponse = await startRegistration({
                optionsJSON: registrationOptions,
            });

            // Verify it
            const encodedResponse = btoa(JSON.stringify(registrationResponse));
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.register.post({
                    userAgent: navigator.userAgent,
                    expectedChallenge: registrationOptions.challenge,
                    registrationResponse: encodedResponse,
                    ssoId: options?.ssoId,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token };

            // Save this to the last authenticator
            await jotaiStore.set(addLastAuthenticationAtom, authentication);

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
