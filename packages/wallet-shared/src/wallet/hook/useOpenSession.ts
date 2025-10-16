import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";
import { getEnableSessionData } from "@/interaction/utils/getEnableDisableData";
import { useConsumePendingInteractions } from "@/wallet/hook/useConsumePendingInteractions";
import { interactionsKey } from "@/wallet/queryKeys/interactions";
import { trackGenericEvent } from "../../common/analytics";

/**
 * Hook used to open a session
 */
export function useOpenSession({
    mutations,
}: {
    mutations?: UseMutationOptions<{ openSessionTxHash: string } | undefined>;
} = {}) {
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    const { mutateAsync: consumePendingInteractions } =
        useConsumePendingInteractions();

    return useMutation({
        ...mutations,
        mutationKey: interactionsKey.openSession,
        mutationFn: async () => {
            // If no wallet address, return
            if (!address) {
                return;
            }

            // Track the initiated event
            const events = [trackGenericEvent("open-session_initiated")];

            // Get timestamp in a month (duration of the session)
            const sessionEnd = new Date();
            sessionEnd.setDate(sessionEnd.getDate() + 30);

            // Get the session open data
            const sessionSetupTx = getEnableSessionData({
                sessionEnd,
                wallet: address,
            });

            // Send the open session calldata
            const openSessionTxHash = await sendTransactionAsync({
                to: address,
                data: sessionSetupTx,
            });

            // Send the pending interactions
            await consumePendingInteractions();

            // Track the completed event
            events.push(trackGenericEvent("open-session_completed"));

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: interactionsKey.sessionStatus.baseKey,
                exact: false,
            });

            await Promise.allSettled(events);

            return {
                openSessionTxHash,
            };
        },
    });
}
