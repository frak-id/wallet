import { useMutation } from "@tanstack/react-query";
import type { MutationOptions } from "@tanstack/react-query";
import { authenticatedBackendApi } from "../../common/api/backendClient";
import { pairingKey } from "../queryKeys";

type UseDeletePairingProps = {
    mutations?: MutationOptions<void, Error, { id: string }>;
};

/**
 * Delete a pairing
 */
export function useDeletePairing({ mutations }: UseDeletePairingProps) {
    return useMutation({
        ...mutations,
        mutationKey: pairingKey.remove,
        mutationFn: async ({ id }: { id: string }) => {
            await authenticatedBackendApi.pairings({ id }).delete();
        },
    });
}
