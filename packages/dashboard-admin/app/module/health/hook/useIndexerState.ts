import { indexerApi } from "@frak-labs/shared/context/server";
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
    const { data, isLoading, error, refetch } = useQuery({
        queryKey: ["indexer-state"],
        queryFn: async () => {
            const result = await indexerApi.get("/status").json<PonderStatus>();
            return Object.values(result)[0];
        },
    });

    return {
        result: data,
        isLoading,
        error,
        refetch,
    };
}
