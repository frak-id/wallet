import { viemClient } from "@/context/common/blockchain/provider";
import { triggerFrkAirdrop } from "@/context/mock/action/airdropFrk";
import {
    getRegisterOptions,
    validateRegistration,
} from "@/context/wallet/action/register";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useState } from "react";
import type { Address } from "viem";

/**
 * Hook that handle the registration process
 */
export function useRegister() {
    // Setter for the last authentication
    const { addLastAuthentication, previousAuthenticators } =
        useLastAuthentications();

    // The current username
    const [username, setUsername] = useState<string | undefined>(undefined);

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
        mutationKey: ["register", username],
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
                username,
                excludeCredentials,
            });

            // Start the registration
            const registrationResponse =
                await startRegistration(registrationOptions);

            // Verify it
            const { username: registeredUsername, wallet } =
                await validateRegistration({
                    username,
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
            await airdropFrk({ wallet: wallet.address });
        },
    });

    /**
     * Mutation used to airdrop frk
     */
    const { isPending: isAirdroppingFrk, mutateAsync: airdropFrk } =
        useMutation({
            mutationKey: ["airdropFrk"],
            mutationFn: async ({ wallet }: { wallet: Address }) => {
                // Trigger the airdrop
                const { txHash } = await triggerFrkAirdrop({
                    user: wallet,
                    amount: "100",
                });
                // Wait for the tx receipt
                await viemClient.waitForTransactionReceipt({
                    hash: txHash,
                    confirmations: 1,
                });
                // Return the tx hash
                return txHash;
            },
        });

    return {
        username,
        setUsername,
        isRegisterInProgress,
        isAirdroppingFrk,
        isSuccess,
        isError,
        error,
        register,
    };
}
