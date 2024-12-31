import { crossAppClient } from "@/context/blockchain/privy-cross-client";
import { authenticatedBackendApi } from "@/context/common/backendClient";
import { sdkSessionAtom, sessionAtom } from "@/module/common/atoms/session";
import type { Session } from "@/types/Session";
import { jotaiStore } from "@module/atoms/store";
import { trackEvent } from "@module/utils/trackEvent";
import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { type Address, type Hex, stringToHex } from "viem";
import { generatePrivateKey } from "viem/accounts";

/**
 * todo:
 *  - Detect if in iframe?? Or just different provider depending on the context (like base one, and another one in the listener side?)
 *  - If in iframe, use the privy cross app client
 *  - If root, use the regular privy logics, with smoother ui etc
 */

export const crossAppWalletQuery = {
    queryKey: ["privy-cross-app", "wallet"],
    queryFn() {
        return crossAppClient.address ?? null;
    },
} as const;

/**
 * Function used to trigger a privy external authentication
 */
export function usePrivyCrossAppAuthenticate(
    opts?: Omit<
        UseMutationOptions<Session, Error>,
        "mutationFn" | "mutationKey"
    >
) {
    const queryClient = useQueryClient();
    return useMutation({
        ...opts,
        mutationKey: ["privy-cross-app", "authenticate"],
        async mutationFn() {
            let wallet = crossAppClient.address;
            if (!wallet) {
                // If we don't have a wallet, request a connection
                await crossAppClient.requestConnection();
                await queryClient.invalidateQueries({
                    queryKey: ["privy-cross-app"],
                    exact: false,
                });
                wallet = crossAppClient.address;
            }

            // If we still don't have a wallet, throw an error
            if (!wallet) {
                throw new Error("No wallet selected");
            }

            // Generate a random challenge
            const challenge = generatePrivateKey();

            // Build the message to sign
            const message = `I want to connect to Frak and I accept the CGU.\n Verification code:${challenge}`;

            // Launch the signature
            const signature = (await crossAppClient.sendRequest(
                "personal_sign",
                [stringToHex(message), wallet]
            )) as Hex | undefined;
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
}
