import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { authKey } from "@frak-labs/wallet-shared/authentication/queryKeys/auth";
import type { Session } from "@frak-labs/wallet-shared/types/Session";
import { getRegisterOptions } from "@frak-labs/wallet-shared/wallet/action/registerOptions";
import { startRegistration } from "@simplewebauthn/browser";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { trackAuthCompleted, trackAuthInitiated } from "../../common/analytics";

/**
 * Hook that handle the registration process
 */
export function useRegister(options?: UseMutationOptions<Session>) {
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
        mutationKey: authKey.register,
        mutationFn: async () => {
            // Identify the user and track the event
            const events = [trackAuthInitiated("register")];

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
                await authenticatedWalletApi.auth.register.post({
                    userAgent: navigator.userAgent,
                    expectedChallenge: registrationOptions.challenge,
                    registrationResponse: encodedResponse,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            // Save this to the last authenticator
            await jotaiStore.set(addLastAuthenticationAtom, session);

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Track the event
            events.push(trackAuthCompleted("register", session));
            await Promise.allSettled(events);

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
