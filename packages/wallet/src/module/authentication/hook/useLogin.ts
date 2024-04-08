import type { PreviousAuthenticatorModel } from "@/context/common/dexie/PreviousAuthenticatorModel";
import { validateAuthentication } from "@/context/wallet/action/authenticate";
import { rpId } from "@/context/wallet/smartWallet/webAuthN";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { useAirdropFrk } from "@/module/common/hook/useAirdropFrk";
import {
    base64URLStringToBuffer,
    startAuthentication,
} from "@simplewebauthn/browser";
import { generateAuthenticationOptions } from "@simplewebauthn/server";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai";

/**
 * Hook that handle the registration process
 */
export function useLogin() {
    // Setter for the last authentication
    const addLastAuthentication = useSetAtom(addLastAuthenticationAtom);

    // Get some FRK
    const { airdropFrk } = useAirdropFrk();

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
        }: { lastAuthentication?: PreviousAuthenticatorModel }) => {
            // Get the authenticate options (if needed)
            const allowCredentials = lastAuthentication
                ? [
                      {
                          id: base64URLStringToBuffer(
                              lastAuthentication.authenticatorId
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
            await addLastAuthentication({
                username,
                wallet,
            });

            // Trigger the frk airdrop without waiting for the tx hash
            await airdropFrk({ wallet: wallet.address, waitForReceipt: false });
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
