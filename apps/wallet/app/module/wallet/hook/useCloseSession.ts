import { getDisableSessionData } from "@/module/interaction/utils/getEnableDisableData";
import { interactionsKey } from "@/module/wallet/queryKeys/interactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";
import { trackGenericEvent } from "../../common/analytics";

export function useCloseSession() {
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    return useMutation({
        mutationKey: interactionsKey.closeSession,
        mutationFn: async () => {
            if (!address) {
                return;
            }

            // Track the initiated event
            const events = [trackGenericEvent("close-session_initiated")];

            // Get the disable data
            const disableTxData = getDisableSessionData({ wallet: address });

            // Send the disable call
            const txHash = await sendTransactionAsync({
                to: address,
                data: disableTxData,
            });
            console.log(`Close session tx hash: ${txHash}`);

            // Track the completed event
            events.push(trackGenericEvent("close-session_completed"));

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: interactionsKey.sessionStatus.baseKey,
                exact: false,
            });

            await Promise.allSettled(events);

            return txHash;
        },
    });
}
