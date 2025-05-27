import { getDisableSessionData } from "@/module/interaction/utils/getEnableDisableData";
import { interactionsKey } from "@/module/wallet/queryKeys/interactions";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";

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

            // Get the disable data
            const disableTxData = getDisableSessionData({ wallet: address });

            // Send the disable call
            const txHash = await sendTransactionAsync({
                to: address,
                data: disableTxData,
            });
            console.log(`Close session tx hash: ${txHash}`);

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: interactionsKey.sessionStatus.baseKey,
                exact: false,
            });

            return txHash;
        },
    });
}
