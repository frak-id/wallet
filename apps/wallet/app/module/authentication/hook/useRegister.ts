import type { Session } from "@frak-labs/wallet-shared";
import {
    addLastAuthentication,
    authenticatedWalletApi,
    authKey,
    createWebAuthnCredential,
    getRegisterOptions,
    sessionStore,
    trackAuthCompleted,
    trackAuthInitiated,
} from "@frak-labs/wallet-shared";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useMutation } from "@tanstack/react-query";
import { toHex } from "viem";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";

/**
 * Result type from WebAuthn credential creation
 */
type CreateCredentialResult = {
    id: string;
    publicKey: { x: bigint; y: bigint; prefix: number } | null;
    raw: unknown;
    isAndroidTauri?: boolean;
};

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
            console.log("[useRegister] Starting WebAuthn createCredential...");
            console.log(
                "[useRegister] Register options:",
                getRegisterOptions()
            );
            console.log(
                "[useRegister] Previous authenticators:",
                previousAuthenticators
            );

            let id: string;
            let publicKey: CreateCredentialResult["publicKey"];
            let raw: unknown;
            let isAndroidTauri = false;

            try {
                const result = (await createWebAuthnCredential({
                    ...getRegisterOptions(),
                    excludeCredentialIds: previousAuthenticators?.map(
                        (cred) => cred.authenticatorId
                    ),
                })) as CreateCredentialResult;
                id = result.id;
                publicKey = result.publicKey;
                raw = result.raw;
                isAndroidTauri = result.isAndroidTauri === true;
                console.log(
                    "[useRegister] WebAuthn createCredential successful"
                );
                console.log("[useRegister] Credential ID:", id);
                console.log("[useRegister] isAndroidTauri:", isAndroidTauri);
            } catch (err) {
                console.error(
                    "[useRegister] WebAuthn createCredential failed:",
                    err
                );
                console.error(
                    "[useRegister] Error details:",
                    JSON.stringify(err, null, 2)
                );
                throw err;
            }

            // For Android, send the full simplewebauthn response
            // For web/iOS, send the ox format
            const encodedResponse = btoa(
                JSON.stringify(isAndroidTauri ? raw : raw)
            );

            // Build request body based on format
            const requestBody = isAndroidTauri
                ? {
                      id,
                      userAgent: navigator.userAgent,
                      // For Android, send placeholder - backend will extract from attestation
                      publicKey: {
                          x: "0x0" as `0x${string}`,
                          y: "0x0" as `0x${string}`,
                          prefix: 4,
                      },
                      raw: encodedResponse,
                  }
                : {
                      id,
                      userAgent: navigator.userAgent,
                      publicKey: publicKey
                          ? {
                                x: toHex(publicKey.x),
                                y: toHex(publicKey.y),
                                prefix: publicKey.prefix,
                            }
                          : {
                                x: "0x0" as `0x${string}`,
                                y: "0x0" as `0x${string}`,
                                prefix: 4,
                            },
                      raw: encodedResponse,
                  };

            const { data, error } =
                await authenticatedWalletApi.auth.register.post(requestBody);
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
