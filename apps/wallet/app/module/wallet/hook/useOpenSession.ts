import { getEnableSessionData } from "@/module/interaction/utils/getEnableDisableData";
import { useConsumePendingInteractions } from "@/module/wallet/hook/useConsumePendingInteractions";
import { interactionsKey } from "@/module/wallet/queryKeys/interactions";
import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";
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

            // Get timestamp in a week (duration of the session)
            const sessionEnd = new Date();
            sessionEnd.setDate(sessionEnd.getDate() + 7);

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

            // Track the event
            await trackGenericEvent("open-session");

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: interactionsKey.sessionStatus.baseKey,
                exact: false,
            });

            return {
                openSessionTxHash,
            };
        },
    });
}
