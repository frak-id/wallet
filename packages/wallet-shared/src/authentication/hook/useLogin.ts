import { WebAuthN } from "@frak-labs/app-essentials";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
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
import { sign as signWebAuthn } from "../webauthn/adapter";

/**
 * Result type from WebAuthn sign operation
 */
type SignResult = {
    metadata:
        | {
              authenticatorData: `0x${string}`;
              challengeIndex: number;
              clientDataJSON: string;
              typeIndex: number;
              userVerificationRequired: boolean;
          }
        | unknown;
    signature:
        | {
              r: bigint;
              s: bigint;
              yParity?: number;
          }
        | unknown;
    raw: {
        id: string;
        response: {
            authenticatorData?: string;
            clientDataJSON?: string;
            signature?: string;
            metadata?: unknown;
        };
    };
};

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
            console.log("[useLogin] Starting WebAuthn sign...");
            console.log("[useLogin] WebAuthN.rpId:", WebAuthN.rpId);
            console.log(
                "[useLogin] lastAuthentication:",
                args?.lastAuthentication
            );

            const challenge = generatePrivateKey();
            let metadata: unknown;
            let signature: unknown;
            let raw: SignResult["raw"];

            try {
                const result = (await signWebAuthn({
                    credentialId: args?.lastAuthentication?.authenticatorId,
                    rpId: WebAuthN.rpId,
                    userVerification: "required",
                    challenge,
                })) as SignResult;
                metadata = result.metadata;
                signature = result.signature;
                raw = result.raw;
                console.log("[useLogin] WebAuthn sign successful");
            } catch (err) {
                console.error("[useLogin] WebAuthn sign failed:", err);
                console.error(
                    "[useLogin] Error details:",
                    JSON.stringify(err, null, 2)
                );
                throw err;
            }

            const credentialId = raw.id;
            console.log(
                "[useLogin] Credential ID from response:",
                credentialId
            );

            // Detect if this is Android Tauri format (has authenticatorData as string)
            const isAndroidTauriFormat =
                typeof raw.response?.authenticatorData === "string";
            console.log(
                "[useLogin] isAndroidTauriFormat:",
                isAndroidTauriFormat
            );

            // For Android Tauri, send the raw response directly
            // For web/iOS (ox format), wrap in metadata/signature structure
            const authenticationResponse = isAndroidTauriFormat
                ? raw
                : {
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
                signature: authenticationResponse as any,
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
