import type { GetProductInfoResponseDto } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";
import { toHex } from "viem";

export function useProductInfo(id: string) {
    const { data, isLoading } = useQuery({
        queryKey: ["product", id],
        queryFn: () =>
            indexerApi
                .get(`products/info?productId=${toHex(BigInt(id))}`)
                .json<GetProductInfoResponseDto>(),
    });

    return {
        product: data,
        isLoading,
    };
}
