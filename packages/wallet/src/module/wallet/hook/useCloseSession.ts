import { getSessionDisableData } from "@/context/interaction/action/interactionSession";
import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";

export function useCloseSession() {
    const queryClient = useQueryClient();
    const { address } = useAccount();
    const { sendTransactionAsync } = useSendTransaction();

    return useMutation({
        mutationKey: ["interactions", "close-session"],
        mutationFn: async () => {
            if (!address) {
                return;
            }

            // Get the disable data
            const disableData = await getSessionDisableData();

            // Build the session disable data
            const txData = encodeWalletMulticall(
                disableData.map((tx) => ({
                    to: address,
                    data: tx,
                }))
            );

            // Send the disable call
            const txHash = await sendTransactionAsync({
                to: address,
                data: txData,
            });

            console.log(`Close session tx hash: ${txHash}`);

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: ["interactions", "session-status"],
                exact: false,
            });

            return txHash;
        },
    });
}
