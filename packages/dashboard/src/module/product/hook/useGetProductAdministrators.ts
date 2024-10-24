import { getProductAdministrators } from "@/context/product/action/getAdministrators";
import { useWalletStatus } from "@frak-labs/nexus-sdk/react";
import { useQuery } from "@tanstack/react-query";
import { type Hex, isAddressEqual, toHex } from "viem";

export function useGetProductAdministrators({ productId }: { productId: Hex }) {
    const { data: walletStatus } = useWalletStatus();

    return useQuery({
        queryKey: [
            "product",
            "team",
            productId.toString(),
            walletStatus?.wallet ?? "no-wallet",
        ],
        queryFn: async () => {
            const administrators = await getProductAdministrators({
                productId: toHex(BigInt(productId)),
            });
            return administrators.map((admin) => ({
                ...admin,
                isMe: walletStatus?.wallet
                    ? isAddressEqual(admin.wallet, walletStatus.wallet)
                    : false,
            }));
        },
    });
}
