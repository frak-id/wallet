import { useQuery } from "@tanstack/react-query";

export function useGetProductFunding() {
    return useQuery({
        queryKey: ["product-funding"],
        queryFn: async () => ({ balance: 0, allowance: 0 }),
    });
}
