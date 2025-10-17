import { WebAuthN } from "@frak-labs/app-essentials";
import { jotaiStore } from "@frak-labs/ui/atoms/store";
import { authKey } from "@frak-labs/wallet-shared/authentication/queryKeys/auth";
import { lastWebAuthNActionAtom } from "@frak-labs/wallet-shared/common/atoms/webauthn";
import type { PreviousAuthenticatorModel } from "@frak-labs/wallet-shared/common/storage/dexie/PreviousAuthenticatorModel";
import type { Session } from "@frak-labs/wallet-shared/types/Session";
import { startAuthentication } from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { authenticatedWalletApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { userAtom } from "@/module/membrs/atoms/user";
import { trackAuthCompleted, trackAuthInitiated } from "../../common/analytics";

/**
 * Hook that handle the registration process
 */
export function useLogin(
    options?: UseMutationOptions<
        Session,
        Error,
        { lastAuthentication?: PreviousAuthenticatorModel } | undefined
    >
) {
    // The mutation that will be used to perform the registration process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutateAsync: login,
    } = useMutation({
        ...options,
        mutationKey: authKey.login,
        mutationFn: async (args?: {
            lastAuthentication?: PreviousAuthenticatorModel;
        }) => {
            // Identify the user and track the event
            const events = [
                trackAuthInitiated("login", {
                    method: args?.lastAuthentication ? "specific" : "global",
                }),
            ];

            // Get the authenticate options (if needed)
            const allowCredentials = args?.lastAuthentication
                ? [
                      {
                          id: args?.lastAuthentication.authenticatorId,
                          transports: args?.lastAuthentication.transports,
                      } as const,
                  ]
                : undefined;

            // Get the authenticate options
            const authenticationOptions = await generateAuthenticationOptions({
                rpID: WebAuthN.rpId,
                userVerification: "required",
                allowCredentials,
                // timeout in ms (3min, can be useful for mobile phone linking)
                timeout: 180_000,
            });

            // Start the authentication
            const authenticationResponse = await startAuthentication({
                optionsJSON: authenticationOptions,
            });

            // Verify it
            const encodedResponse = btoa(
                JSON.stringify(authenticationResponse)
            );
            const { data, error } =
                await authenticatedWalletApi.auth.login.post({
                    expectedChallenge: authenticationOptions.challenge,
                    authenticatorResponse: encodedResponse,
                });
            if (error) {
                throw error;
            }

            // Store this last webauthn action
            jotaiStore.set(lastWebAuthNActionAtom, {
                wallet: data.address,
                signature: authenticationResponse,
                msg: authenticationOptions.challenge,
            });

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            // Save this to the last authenticator
            await jotaiStore.set(addLastAuthenticationAtom, session);

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Store the mocked user for now
            // TODO: Remove this once the user is properly stored in the database
            jotaiStore.set(userAtom, {
                _id: data.address,
                username: "mocked-username",
            });

            // Track the event
            events.push(trackAuthCompleted("login", session));

            await Promise.allSettled(events);

            return session;
        },
    });

    return {
        isLoading,
        isSuccess,
        isError,
        error,
        login,
    };
}
