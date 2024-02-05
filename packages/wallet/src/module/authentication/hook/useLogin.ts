import {
    getAuthenticateOptions,
    validateAuthentication,
} from "@/context/wallet/action/authenticate";
import { useLastAuthentications } from "@/module/authentication/hook/useLastAuthentications";
import { startAuthentication } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

/**
 * Hook that handle the registration process
 */
export function useLogin() {
    // Router and transition that will be used post login
    const router = useRouter();
    const [, startTransition] = useTransition();

    // Setter for the last authentication
    const { lastAuthentications, addLastAuthentication } =
        useLastAuthentications();

    const [selectedUsername, setSelectedUsername] = useState<string>();

    // The mutation that will be used to perform the registration process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
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

            // Start the transition
            startTransition(() => {
                // Redirect to the wallet
                // TODO: page path TBD
                router.push("/wallet");
            });
        },
    });

    return {
        lastAuthentications,
        setSelectedUsername,
        isLoading,
        isSuccess,
        isError,
        login,
    };
}
