import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { authKey } from "@/module/authentication/queryKeys/auth";
import { authenticatedBackendApi } from "@/module/common/api/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { lastWebAuthNActionAtom } from "@/module/common/atoms/webauthn";
import type { PreviousAuthenticatorModel } from "@/module/common/storage/dexie/PreviousAuthenticatorModel";
import { userAtom } from "@/module/membrs/atoms/user";
import type { Session } from "@/types/Session";
import { WebAuthN } from "@frak-labs/app-essentials";
import { jotaiStore } from "@shared/module/atoms/store";
import { startAuthentication } from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import type { Hex } from "viem";

/**
 * Hook that handle the registration process
 */
export function useLogin(
    options?: UseMutationOptions<
        Session,
        Error,
        { lastAuthentication?: PreviousAuthenticatorModel } | undefined
    > & { ssoId?: Hex }
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
                await authenticatedBackendApi.auth.wallet.login.post({
                    expectedChallenge: authenticationOptions.challenge,
                    authenticatorResponse: encodedResponse,
                    ssoId: options?.ssoId,
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
