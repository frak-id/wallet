import { useQuery } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";

export function useSdkConfig({ merchantId }: { merchantId: string }) {
    return useQuery({
        queryKey: ["merchant", merchantId, "sdk-config"],
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                ["sdk-config"].get();

            if (error) throw new Error("Failed to fetch SDK config");
            return data;
        },
        enabled: !!merchantId,
    });
}
