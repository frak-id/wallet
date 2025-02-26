import { dexieDb } from "@/module/common/storage/dexie/dexieDb";
import { useQuery } from "@tanstack/react-query";

/**
 * Hook used to fetch all the previous authenticators
 */
export const usePreviousAuthenticators = () =>
    useQuery({
        queryKey: ["previousAuthenticators"],
        queryFn: async () => {
            return dexieDb.previousAuthenticator.toArray();
        },
        gcTime: 30_000,
        enabled: true,
    });
