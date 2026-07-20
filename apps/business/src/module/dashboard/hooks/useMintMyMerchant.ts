import {
    getTokenAddressForStablecoin,
    type Stablecoin,
} from "@frak-labs/app-essentials";
import { useSiweAuthenticate } from "@frak-labs/react-sdk";
import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { useState } from "react";
import { authenticatedBackendApi } from "@/api/backendClient";
import { extractAuthErrorMessage } from "@/module/auth/utils/authError";
import { merchantQueryKey } from "@/module/merchant/queries/queryKeys";
import { useAuthStore } from "@/stores/authStore";

/**
 * Hook to register a new merchant
 */
export function useRegisterMerchant(
    options?: UseMutationOptions<
        { merchantId: string; verifiedViaShopify: boolean },
        Error,
        {
            name: string;
            domain: string;
            setupCode?: string;
            currency: Stablecoin;
            allowedDomains?: string[];
            // Platform-admin only (ignored by the backend otherwise).
            skipDomainValidation?: boolean;
            useFrakBank?: boolean;
            takeads?: { takeadsMerchantId: number; trackingLink: string };
        }
    >
) {
    const queryClient = useQueryClient();
    const { mutateAsync: siweAuthenticate } = useSiweAuthenticate();
    const [infoTxt, setInfoTxt] = useState<string | undefined>();

    const mutation = useMutation({
        ...options,
        mutationKey: ["merchant", "register"],
        async onSettled() {
            // Clear info post mutation
            setInfoTxt(undefined);
            await queryClient.invalidateQueries({
                queryKey: merchantQueryKey(),
            });
        },
        async mutationFn({
            name,
            domain,
            setupCode,
            currency,
            allowedDomains,
            skipDomainValidation,
            useFrakBank,
            takeads,
        }) {
            const defaultRewardToken = getTokenAddressForStablecoin(currency);

            // Walletless accounts (§4.10): the step-up-verified session IS the
            // ownership proof — no SIWE signature to collect, `message`/
            // `signature` are simply omitted from the request body.
            const wallet = useAuthStore.getState().wallet;
            let siweProof: {
                message: string;
                signature: `0x${string}`;
            } | null = null;
            if (wallet) {
                const statement = `I authorize registration of merchant "${domain}" to wallet ${wallet}`;
                setInfoTxt("Please sign the registration message");
                siweProof = await siweAuthenticate({ siwe: { statement } });
            }

            // Register the merchant
            setInfoTxt("Registering your merchant");

            const { data, error } =
                await authenticatedBackendApi.merchant.register.post({
                    message: siweProof?.message,
                    signature: siweProof?.signature,
                    domain,
                    name,
                    setupCode,
                    defaultRewardToken,
                    allowedDomains,
                    skipDomainValidation,
                    useFrakBank,
                    takeads,
                });
            if (error) {
                throw new Error(
                    extractAuthErrorMessage(error, "Registration failed")
                );
            }

            setInfoTxt("Registration complete");
            return {
                merchantId: data.merchantId,
                verifiedViaShopify: data.verifiedViaShopify,
            };
        },
    });

    return { mutation, infoTxt };
}
