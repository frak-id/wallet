import { useMutation } from "@tanstack/react-query";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import { pairingKey } from "../queryKeys";

/**
 * Delete a pairing
 */
export function useDeletePairing() {
    return useMutation({
        mutationKey: pairingKey.remove,
        mutationFn: async ({ id }: { id: string }) => {
            await authenticatedBackendApi.pairings({ id }).delete();
        },
    });
}
