import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { authKey } from "@/module/authentication/queryKeys/auth";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { getRegisterOptions } from "@/module/wallet/action/registerOptions";
import type { Session } from "@/types/Session";
import { jotaiStore } from "@shared/module/atoms/store";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { Hex } from "viem";
import { trackAuthCompleted, trackAuthInitiated } from "../../common/analytics";

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
        mutationKey: authKey.register,
        mutationFn: async () => {
            // Identify the user and track the event
            const events = [
                trackAuthInitiated("register", {
                    ssoId: options?.ssoId,
                }),
            ];

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

            // Check if the user is in a six degrees context
            const isSixDegrees = await isSixDegreesContext();

            // Verify it
            const encodedResponse = btoa(JSON.stringify(registrationResponse));
            const { data, error } =
                await authenticatedWalletApi.auth.register.post({
                    userAgent: navigator.userAgent,
                    expectedChallenge: registrationOptions.challenge,
                    registrationResponse: encodedResponse,
                    ssoId: options?.ssoId,
                    isSixDegrees,
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
            events.push(
                trackAuthCompleted("register", session, {
                    ssoId: options?.ssoId,
                })
            );
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

/**
 * Is the current context a six degrees context
 */
async function isSixDegreesContext() {
    const currentContext = jotaiStore.get(iframeResolvingContextAtom);

    if (!currentContext?.origin) {
        return false;
    }

    const getSixDegrees = await authenticatedWalletApi.auth.routing.get({
        query: {
            origin: currentContext.origin,
        },
    });

    return getSixDegrees.data === "sui";
}
