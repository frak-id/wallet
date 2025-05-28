import { useQuery } from "@tanstack/react-query";
import { authenticatedWalletApi } from "../../common/api/backendClient";
import { pairingKey } from "../queryKeys";

/**
 * Get info for a pairing
 */
export function usePairingInfo({ id }: { id?: string }) {
    const query = useQuery({
        queryKey: pairingKey.getInfo(id),
        queryFn: async () => {
            if (!id) {
                return null;
            }

            const { data } = await authenticatedWalletApi
                .pairings({ id })
                .get();
            console.log("data", data);

            if (!data) {
                throw new Error("Failed to fetch pairing info");
            }

            return data;
        },
        enabled: !!id,
    });

    return query;
}
