import { validateRegistration } from "@/context/wallet/action/register";
import { getRegisterOptions } from "@/context/wallet/action/registerOptions";
import { addLastAuthenticationAtom } from "@/module/authentication/atoms/lastAuthenticator";
import { usePreviousAuthenticators } from "@/module/authentication/hook/usePreviousAuthenticators";
import { useAirdropFrk } from "@/module/common/hook/useAirdropFrk";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useSetAtom } from "jotai/index";

/**
 * Hook that handle the registration process
 */
export function useRegister() {
    // Setter for the last authentication
    const addLastAuthentication = useSetAtom(addLastAuthenticationAtom);
    const { data: previousAuthenticators } = usePreviousAuthenticators();

    // Get some FRK
    const { isAirdroppingFrk, airdropFrk } = useAirdropFrk();

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
        mutationKey: ["register"],
        mutationFn: async () => {
            // Build the credentials to exclude
            const excludeCredentials = previousAuthenticators?.map(
                (auth) =>
                    ({
                        id: auth.authenticatorId,
                        transports: auth.transports,
                    }) as const
            );

            console.log("Fetching register options", { excludeCredentials });
            // Get the registration options
            const registrationOptions = await getRegisterOptions({
                excludeCredentials,
            });

            // Start the registration
            const registrationResponse =
                await startRegistration(registrationOptions);

            // Verify it
            const { username: registeredUsername, wallet } =
                await validateRegistration({
                    expectedChallenge: registrationOptions.challenge,
                    registrationResponse,
                    userAgent: navigator.userAgent,
                });

            // Save this to the last authenticator
            await addLastAuthentication({
                username: registeredUsername,
                wallet,
                transports: registrationResponse.response.transports,
            });

            // Launch the frk airdrop
            await airdropFrk({ wallet: wallet.address, waitForReceipt: false });
        },
    });

    return {
        isRegisterInProgress,
        isAirdroppingFrk,
        isSuccess,
        isError,
        error,
        register,
    };
}
