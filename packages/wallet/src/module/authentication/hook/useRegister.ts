import { viemClient } from "@/context/common/blockchain/provider";
import { triggerFrkAirdrop } from "@/context/mock/actions/airdropFrk";
import {
    getRegisterOptions,
    getUsername,
    isUsernameAvailable,
    validateRegistration,
} from "@/context/wallet/action/register";
import { useLastAuthentications } from "@/module/authentication/providers/LastAuthentication";
import { startRegistration } from "@simplewebauthn/browser";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import type { Address } from "viem";

/**
 * Hook that handle the registration process
 */
export function useRegister() {
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
        isPending: isRegisterInProgress,
        isSuccess,
        isError,
        error,
        mutateAsync: register,
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

            // Launch the frk airdrop
            await airdropFrk({ wallet: wallet.address });
        },
    });

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
        isAvailable,
        setUsername,
        isRegisterInProgress,
        isAirdroppingFrk,
        isSuccess,
        isError,
        error,
        register,
    };
}
