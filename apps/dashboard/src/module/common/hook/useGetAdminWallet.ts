import { backendApi } from "@frak-labs/shared/context/server";
import { useQuery } from "@tanstack/react-query";
import type { Hex } from "viem";

export function useGetAdminWallet(
    args: { key: string; productId?: never } | { key?: never; productId: Hex }
) {
    return useQuery({
        queryKey: ["admin-wallet", args.key ?? args.productId ?? "no-key"],
        queryFn: async () => {
            const { data: wallet, error } = args.key
                ? await backendApi.common.adminWallet.get({
                      query: { key: args.key },
                  })
                : await backendApi.common.adminWallet.get({
                      query: { productId: args.productId },
                  });
            if (error) {
                throw error;
            }
            return wallet?.pubKey ?? null;
        },
    });
}
