import {
    getRegisterOptions,
    getUsername,
    isUsernameAvailable,
    validateRegistration,
} from "@/context/wallet/action/register";
import { useLastAuthentications } from "@/module/authentication/hook/useLastAuthentications";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";

/**
 * Hook that handle the registration process
 */
export function useRegister() {
    // Router and transition that will be used post login
    const router = useRouter();
    const [, startTransition] = useTransition();

    // Setter for the last authentication
    const { addLastAuthentication } = useLastAuthentications();

    // The current username
    const [username, setUsername] = useState<string>("");

    // The current username
    const [isAvailable, setIsAvailable] = useState<boolean>(false);

    // Generate a random username on mount
    useEffect(() => {
        if (username === "") {
            // Generate a new username on mount
            getUsername().then(setUsername);
            return;
        }

        // Check if it's available
        isUsernameAvailable(username).then(setIsAvailable);
    }, [username]);

    // The mutation that will be used to perform the registration process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutate: register,
    } = useMutation({
        mutationKey: ["register", username],
        mutationFn: async () => {
            // If username not available, early exit
            if (!isAvailable) {
                return;
            }

            // Get the registration options
            const registrationOptions = await getRegisterOptions({ username });

            // Start the registration
            const registrationResponse =
                await startRegistration(registrationOptions);

            // Verify it
            const wallet = await validateRegistration({
                username,
                registrationResponse,
                userAgent: navigator.userAgent,
            });

            // Save this to the last authenticator
            addLastAuthentication({
                username,
                wallet,
            });

            // TODO: Also trigger a FRK airdrop here

            // Start the transition
            startTransition(() => {
                // Redirect to the wallet
                // TODO: page path TBD
                router.push("/wallet");
            });
        },
    });

    return {
        username,
        isAvailable,
        setUsername,
        isLoading,
        isSuccess,
        isError,
        error,
        register,
    };
}
