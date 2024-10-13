import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { rpId } from "@/context/wallet/smartWallet/webAuthN";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { backendApi } from "@frak-labs/shared/context/server";
import { startAuthentication } from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

/**
 * Hook that handle the registration process
 */
export function useLogin(
    mutations?: UseMutationOptions<
        Session,
        Error,
        { lastAuthentication?: PreviousAuthenticatorModel } | undefined
    >
) {
    // Setter for the last authentication
    const addLastAuthentication = useSetAtom(addLastAuthenticationAtom);

    // Setter for the session
    const setSession = useSetAtom(sessionAtom);

    // The mutation that will be used to perform the registration process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutateAsync: login,
    } = useMutation({
        ...mutations,
        mutationKey: ["login"],
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
                rpID: rpId,
                userVerification: "required",
                allowCredentials,
                // timeout in ms (3min, can be useful for mobile phone linking)
                timeout: 180_000,
            });

            // Start the authentication
            const authenticationResponse = await startAuthentication(
                authenticationOptions
            );

            // Verify it
            const encodedResponse = Buffer.from(
                JSON.stringify(authenticationResponse)
            ).toString("base64");
            const { data: session, error } =
                await backendApi.auth.wallet.login.post({
                    expectedChallenge: authenticationOptions.challenge,
                    authenticatorResponse: encodedResponse,
                });
            if (error) {
                throw error;
            }

            // Save this to the last authenticator
            await addLastAuthentication(session);

            // Set the session
            setSession(session);

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
