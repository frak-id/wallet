import type { Session } from "@frak-labs/wallet-shared";
import {
    addLastAuthentication,
    authenticatedWalletApi,
    authKey,
    getRegisterOptions,
    sessionStore,
    trackAuthCompleted,
    trackAuthInitiated,
} from "@frak-labs/wallet-shared";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { toHex } from "viem";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";

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

            // Start the registration
            const { id, publicKey, raw } = await WebAuthnP256.createCredential({
                ...getRegisterOptions(),
                excludeCredentialIds: previousAuthenticators?.map(
                    (cred) => cred.authenticatorId
                ),
            });
            console.log("Output", {
                id,
                publicKey,
                raw,
            });

            // Verify it
            const encodedResponse = btoa(JSON.stringify(raw));
            const { data, error } =
                await authenticatedWalletApi.auth.register.post({
                    id,
                    userAgent: navigator.userAgent,
                    publicKey: {
                        x: toHex(publicKey.x),
                        y: toHex(publicKey.y),
                        prefix: publicKey.prefix,
                    },
                    raw: encodedResponse,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            // Save this to the last authenticator
            await addLastAuthentication(session);

            // Store the session
            sessionStore.getState().setSession(session);
            sessionStore.getState().setSdkSession(sdkJwt);

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
