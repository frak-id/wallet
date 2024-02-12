import { validateAuthentication } from "@/context/wallet/action/authenticate";
import { rpId } from "@/context/wallet/smartWallet/webAuthN";
import {
    type LastAuthentication,
    useLastAuthentications,
} from "@/module/authentication/providers/LastAuthentication";
import {
    base64URLStringToBuffer,
    startAuthentication,
} from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook that handle the registration process
 */
export function useLogin() {
    // Setter for the last authentication
    const { addLastAuthentication } = useLastAuthentications();

    // The mutation that will be used to perform the registration process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutateAsync: login,
    } = useMutation({
        mutationKey: ["login"],
        mutationFn: async ({
            lastAuthentication,
        }: { lastAuthentication?: LastAuthentication }) => {
            // Get the authenticate options (if needed)
            const allowCredentials = lastAuthentication
                ? [
                      {
                          id: base64URLStringToBuffer(
                              lastAuthentication.wallet.authenticatorId
                          ),
                          type: "public-key",
                          transports: lastAuthentication.transports,
                      } as const,
                  ]
                : undefined;

            // Get the authenticate options
            const authenticationOptions = await generateAuthenticationOptions({
                rpID: rpId,
                userVerification: "required",
                allowCredentials,
            });

            // Start the authentication
            const authenticationResponse = await startAuthentication(
                authenticationOptions
            );

            // Verify it
            const { username, wallet } = await validateAuthentication({
                expectedChallenge: authenticationOptions.challenge,
                authenticationResponse,
            });

            // Save this to the last authenticator
            addLastAuthentication({
                username,
                wallet,
            });
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
