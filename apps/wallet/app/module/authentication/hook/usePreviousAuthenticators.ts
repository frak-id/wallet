import { authenticatorStorage, authKey } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to fetch all the previous authenticators
 */
export const usePreviousAuthenticators = () =>
    useQuery({
        queryKey: authKey.previousAuthenticators,
        queryFn: async () => {
            return await authenticatorStorage.getAll();
        },
        gcTime: 30_000,
        enabled: true,
    });
