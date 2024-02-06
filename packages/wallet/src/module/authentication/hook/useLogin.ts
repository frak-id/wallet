import {
    getAuthenticateOptions,
    validateAuthentication,
} from "@/context/wallet/action/authenticate";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";
import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";

/**
 * Hook that handle the registration process
 */
export function useLogin() {
    // Setter for the last authentication
    const { addLastAuthentication } = useLastAuthentications();

    const [selectedUsername, setSelectedUsername] = useState<string>();

    // The mutation that will be used to perform the registration process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutate: login,
    } = useMutation({
        mutationKey: ["login", selectedUsername],
        mutationFn: async () => {
            // If no username selected, directly exit
            if (!selectedUsername) {
                return;
            }

            // Get the authenticate options
            const authenticationOptions = await getAuthenticateOptions({
                username: selectedUsername,
            });

            // Start the authentication
            const authenticationResponse = await startAuthentication(
                authenticationOptions
            );

            // Verify it
            const wallet = await validateAuthentication({
                authenticationResponse,
            });

            // Save this to the last authenticator
            addLastAuthentication({
                username: selectedUsername,
                wallet,
            });
        },
    });

    return {
        setSelectedUsername,
        isLoading,
        isSuccess,
        isError,
        error,
        login,
    };
}
