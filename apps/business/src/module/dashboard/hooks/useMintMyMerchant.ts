import { useSiweAuthenticate, useWalletStatus } from "@frak-labs/react-sdk";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { authenticatedBackendApi } from "@/context/api/backendClient";

/**
 * Extract error message from API error response
 */
function extractErrorMessage(error: unknown): string {
    if (typeof error === "string") return error;
    if (
        error &&
        typeof error === "object" &&
        "value" in error &&
        typeof error.value === "string"
    ) {
        return error.value;
    }
    return "Registration failed";
}

/**
 * Hook to register a new merchant
 */
export function useRegisterMerchant(
    options?: UseMutationOptions<
        { merchantId: string },
        Error,
        {
            name: string;
            domain: string;
            setupCode?: string;
        }
    >
) {
    const { data: walletStatus } = useWalletStatus();
    const { mutateAsync: siweAuthenticate } = useSiweAuthenticate();
    const [infoTxt, setInfoTxt] = useState<string | undefined>();

    const mutation = useMutation({
        ...options,
        mutationKey: ["merchant", "register"],
        onSettled() {
            // Clear info post mutation
            setInfoTxt(undefined);
        },
        async mutationFn({ name, domain, setupCode }) {
            const wallet = walletStatus?.wallet;
            if (!wallet) {
                throw new Error("Wallet not connected");
            }

            // Build the registration statement
            const statement = `I authorize registration of merchant "${domain}" to wallet ${wallet}`;

            // Sign using SIWE with our custom statement
            setInfoTxt("Please sign the registration message");
            const siweResult = await siweAuthenticate({
                siwe: {
                    statement,
                },
            });

            // Register the merchant
            setInfoTxt("Registering your merchant");
            const { data, error } =
                await authenticatedBackendApi.merchant.register.post({
                    message: siweResult.message,
                    signature: siweResult.signature,
                    domain,
                    name,
                    setupCode,
                });
            if (error) {
                throw new Error(extractErrorMessage(error));
            }

            setInfoTxt("Registration complete");
            return {
                merchantId: data.merchantId,
            };
        },
    });

    return { mutation, infoTxt };
}

/**
 * @deprecated Use useRegisterMerchant instead
 */
export const useMintMyMerchant = useRegisterMerchant;

/**
 * @deprecated Use useMintMyMerchant instead
 */
export const useMintMyProduct = useMintMyMerchant;
