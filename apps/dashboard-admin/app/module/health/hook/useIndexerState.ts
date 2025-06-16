import { indexerApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";

type PonderStatus = {
    [key: string]: {
        ready: boolean;
        block: {
            timestamp: number;
            number: number;
        };
    };
};

export function useIndexerState() {
    const { data, isLoading, refetch } = useQuery({
        queryKey: ["indexer-state"],
        queryFn: async () => {
            const result = await indexerApi.get("status").json<PonderStatus>();
            return Object.values(result)[0];
        },
    });

    return {
        state: data,
        isLoading,
        refetch,
    };
}
