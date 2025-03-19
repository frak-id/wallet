import { getDisableSessionData } from "@/module/interaction/utils/getEnableDisableData";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";
import {
    walletInteractionsMutationKeys,
    walletInteractionsQueryKeys,
} from "../queryKeys/interactions";

export function useCloseSession() {
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    return useMutation({
        mutationKey: walletInteractionsMutationKeys.closeSession,
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
                queryKey: walletInteractionsQueryKeys.sessionStatus.base,
                exact: false,
            });

            return txHash;
        },
    });
}
