import { authKey } from "@frak-labs/wallet-shared/authentication/queryKeys/auth";
import { useQuery } from "@tanstack/react-query";
import { dexieDb } from "@/module/common/storage/dexie/dexieDb";

/**
 * Hook used to fetch all the previous authenticators
 */
export const usePreviousAuthenticators = () =>
    useQuery({
        queryKey: authKey.previousAuthenticators,
        queryFn: async () => {
            return dexieDb.previousAuthenticator.toArray();
        },
        gcTime: 30_000,
        enabled: true,
    });
