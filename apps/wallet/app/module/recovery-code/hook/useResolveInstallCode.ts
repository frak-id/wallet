import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useCallback, useState } from "react";
import { installCodeStore } from "../stores/installCodeStore";

/**
 * Hook to resolve an install code via the backend.
 *
 * On success, stores the resolved data (code + merchant info) in the
 * persisted `installCodeStore` so it can be consumed after registration.
 */
export function useResolveInstallCode() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string>();
    const setPendingCode = installCodeStore((s) => s.setPendingCode);

    const resolve = useCallback(
        async (code: string) => {
            setIsLoading(true);
            setError(undefined);

            const { data, error: apiError } =
                await authenticatedBackendApi.user.identity[
                    "install-code"
                ].resolve.post({ code });

            setIsLoading(false);

            if (apiError || !data || "error" in data) {
                setError("INVALID");
                return null;
            }

            setPendingCode({
                code,
                merchantId: data.merchantId,
                merchant: data.merchant,
            });

            return data;
        },
        [setPendingCode]
    );

    return { resolve, isLoading, error, setError };
}
