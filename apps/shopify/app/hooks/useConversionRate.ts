import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { backendApi } from "../utils/backendApi";

/**
 * Fetch the conversion rate for a given token
 */
export function useConversionRate({ token }: { token?: Address }) {
    const { data: rate, ...query } = useQuery({
        enabled: !!token,
        queryKey: ["conversion-rate", token],
        queryFn: async () => {
            if (!token) {
                return {
                    usd: 0,
                    eur: 0,
                    gbp: 0,
                };
            }

            try {
                const { data, error } = await backendApi.common.rate.get({
                    query: { token },
                });
                if (error) throw error;
                return data;
            } catch (e) {
                console.error("Unable to fetch conversion rate", e);
                return {
                    usd: 1,
                    eur: 0.85,
                    gbp: 0.72,
                };
            }
        },
    });

    return {
        ...query,
        rate,
    };
}
