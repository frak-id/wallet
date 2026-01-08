import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import type { Hex } from "viem";

type GenerateMobileAuthCodeParams = {
    productId: Hex;
    returnOrigin: string;
};

type GenerateMobileAuthCodeResult = {
    authCode: string;
};

/**
 * Generate a mobile auth code (60s JWT) for partner site to exchange for SDK session.
 */
export function useGenerateMobileAuthCode() {
    const { mutateAsync, isPending, isSuccess, isError, error } = useMutation({
        mutationKey: ["mobile-auth", "generate-code"],
        async mutationFn({
            productId,
            returnOrigin,
        }: GenerateMobileAuthCodeParams): Promise<GenerateMobileAuthCodeResult> {
            const { data, error } =
                await authenticatedWalletApi.auth.mobile.code.post({
                    productId,
                    returnOrigin,
                });

            if (error) {
                throw error;
            }

            return data;
        },
    });

    return {
        generateAuthCode: mutateAsync,
        isGenerating: isPending,
        isSuccess,
        isError,
        error,
    };
}
