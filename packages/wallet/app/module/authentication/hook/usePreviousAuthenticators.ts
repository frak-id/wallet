import { authMutationKeys } from "@/module/authentication/queryKeys/auth";
import { dexieDb } from "@/module/common/storage/dexie/dexieDb";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to fetch all the previous authenticators
 */
export const usePreviousAuthenticators = () =>
    useQuery({
        queryKey: authMutationKeys.previousAuthenticators,
        queryFn: async () => {
            return dexieDb.previousAuthenticator.toArray();
        },
        gcTime: 30_000,
        enabled: true,
    });
