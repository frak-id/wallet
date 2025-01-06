import { authenticatedBackendApi } from "@/context/common/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import { usePrivyContext } from "@/module/common/provider/PrivyProvider";
import type { Session } from "@/types/Session";
import { jotaiStore } from "@module/atoms/store";
import { trackEvent } from "@module/utils/trackEvent";
import { useMutation } from "@tanstack/react-query";
import type { UseMutationOptions } from "@tanstack/react-query";
import { type Address, stringToHex } from "viem";
import { generatePrivateKey } from "viem/accounts";

/**
 * Hook that handle the registration process
 */
export function usePrivyLogin(options?: UseMutationOptions<Session>) {
    const { login, signMessage } = usePrivyContext();

    // The mutation that will be used to perform the privy login process
    const {
        isPending: isLoading,
        isSuccess,
        isError,
        error,
        mutate: privyLogin,
        mutateAsync: privyLoginAsync,
    } = useMutation({
        ...options,
        mutationKey: ["privy-login"],
        mutationFn: async () => {
            // Do the initial privy login stuff
            const wallet = await login();
            if (!wallet) {
                throw new Error("No wallet selected");
            }

            // Generate a random challenge
            const challenge = generatePrivateKey();

            // Build the message to sign
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            // Sign the message
            const signature = await signMessage({
                hash: stringToHex(message),
                address: wallet,
            });
            if (!signature) {
                console.warn("No signature");
                throw new Error("No signature returned");
            }

            // Launch the backend authentication process
            const { data, error } =
                await authenticatedBackendApi.auth.wallet.ecdsaLogin.post({
                    expectedChallenge: challenge,
                    signature,
                    wallet: wallet as Address,
                });
            if (error) {
                throw error;
            }

            // Extract a few data
            const { token, sdkJwt, ...authentication } = data;
            const session = { ...authentication, token };

            // Store the session
            jotaiStore.set(sessionAtom, session);
            jotaiStore.set(sdkSessionAtom, sdkJwt);

            // Track the event
            trackEvent("cta-ecdsa-login");

            // Return the built session
            return session;
        },
    });

    return {
        isLoading,
        isSuccess,
        isError,
        error,
        privyLogin,
        privyLoginAsync,
    };
}
