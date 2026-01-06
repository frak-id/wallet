import { WebAuthN } from "@frak-labs/app-essentials";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { WebAuthnP256 } from "ox";
import { generatePrivateKey } from "viem/accounts";
import { trackAuthCompleted, trackAuthInitiated } from "../../common/analytics";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import type { PreviousAuthenticatorModel } from "../../common/storage/PreviousAuthenticatorModel";
import {
    addLastAuthentication,
    authenticationStore,
} from "../../stores/authenticationStore";
import { sessionStore } from "../../stores/sessionStore";
import { userStore } from "../../stores/userStore";
import type { Session } from "../../types/Session";
import { authKey } from "../queryKeys/auth";
import { getTauriGetFn } from "../webauthn/tauriBridge";

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

            // Sign with WebAuthn using ox
            // Only pass getFn if defined (Android), omit for iOS/web to use browser default
            const challenge = generatePrivateKey();
            const tauriGetFn = getTauriGetFn();
            const { metadata, signature, raw } = await WebAuthnP256.sign({
                credentialId: args?.lastAuthentication?.authenticatorId,
                rpId: WebAuthN.rpId,
                userVerification: "required",
                challenge,
                ...(tauriGetFn && { getFn: tauriGetFn }),
            });
            const credentialId = raw.id;

            // Convert ox response to the format expected by backend
            const authenticationResponse = {
                id: credentialId,
                response: {
                    metadata,
                    signature,
                },
            };

            // Verify it
            const encodedResponse = btoa(
                JSON.stringify(authenticationResponse)
            );
            const { data, error } =
                await authenticatedWalletApi.auth.login.post({
                    expectedChallenge: challenge,
                    authenticatorResponse: encodedResponse,
                });
            if (error) {
                throw error;
            }

            // Store this last webauthn action
            authenticationStore.getState().setLastWebAuthNAction({
                wallet: data.address,
                signature: authenticationResponse,
                challenge: challenge,
            });

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token } as Session;

            // Save this to the last authenticator
            await addLastAuthentication(session);

            // Store the session
            sessionStore.getState().setSession(session);
            sessionStore.getState().setSdkSession(sdkJwt);

            // Store the mocked user for now
            // TODO: Remove this once the user is properly stored in the database
            userStore.getState().setUser({
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
