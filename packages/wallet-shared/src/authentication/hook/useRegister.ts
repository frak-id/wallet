import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { startRegistration } from "@simplewebauthn/browser";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { trackAuthCompleted, trackAuthInitiated } from "../../common/analytics";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "../../common/atoms/session";
import type { Session } from "../../types/Session";
import { getRegisterOptions } from "../../wallet/action/registerOptions";
import { addLastAuthenticationAtom } from "../atoms/lastAuthenticator";
import { authKey } from "../queryKeys/auth";
import { usePreviousAuthenticators } from "./usePreviousAuthenticators";

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
