import { authenticatorStorage, authKey } from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";

export const usePreviousAuthenticators = () =>
    useQuery({
        queryKey: authKey.previousAuthenticators,
        queryFn: async () => {
            return await authenticatorStorage.getAll();
        },
        gcTime: 30_000,
    });
