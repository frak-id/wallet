import type { GetAllProductsResponseDto } from "@frak-labs/app-essentials";
import { indexerApi } from "@frak-labs/shared/context/server";
import { useQuery } from "@tanstack/react-query";

export function useGetAllProduct() {
    const { data, isLoading } = useQuery({
        queryKey: ["products"],
        queryFn: () =>
            indexerApi
                .get("products")
                .json<GetAllProductsResponseDto>()
                .then((products) =>
                    products.map((product) => ({
                        ...product,
                        id: BigInt(product.id),
                        createTimestamp: BigInt(product.createTimestamp),
                        productTypes: BigInt(product.productTypes),
                    }))
                ),
    });

    return {
        products: data,
        isLoading,
    };
}

export type MappedProduct = Omit<
    GetAllProductsResponseDto[number],
    "id" | "productTypes" | "createTimestamp"
> & {
    id: bigint;
    createTimestamp: bigint;
    productTypes: bigint;
};
