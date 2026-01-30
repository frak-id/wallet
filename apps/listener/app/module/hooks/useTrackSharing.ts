import { authenticatedBackendApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useSafeResolvingContext } from "@/module/stores/hooks";

export function useTrackSharing() {
    const { merchantId } = useSafeResolvingContext();

    return useMutation({
        mutationKey: ["track-sharing", merchantId],
        mutationFn: async () => {
            if (!merchantId) return;

            await authenticatedBackendApi.user.track.sharing.post({
                merchantId,
            });
        },
    });
}
