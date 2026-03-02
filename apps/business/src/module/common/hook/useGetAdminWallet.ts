import { backendApi } from "@frak-labs/client/server";
import { useQuery } from "@tanstack/react-query";

export function useGetAdminWallet({ key }: { key: string }) {
    return useQuery({
        queryKey: ["admin-wallet", key],
        queryFn: async () => {
            const { data: wallet, error } =
                await backendApi.common.adminWallet.get({
                    query: { key },
                });
            if (error) {
                throw error;
            }
            return wallet?.pubKey ?? null;
        },
    });
}
