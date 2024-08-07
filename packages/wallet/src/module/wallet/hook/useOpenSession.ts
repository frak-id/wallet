import { getSessionEnableData } from "@/context/interaction/action/interactionSession";
import { encodeWalletMulticall } from "@/context/wallet/utils/multicall";
import { useConsumePendingInteractions } from "@/module/wallet/hook/useConsumePendingInteractions";
import {
    type UseMutationOptions,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import { useAccount, useSendTransaction } from "wagmi";

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
        mutationKey: ["interactions", "open-session"],
        mutationFn: async () => {
            // If no wallet address, return
            if (!address) {
                return;
            }

            // Get timestamp in a week (duration of the session)
            const sessionEnd = new Date();
            sessionEnd.setDate(sessionEnd.getDate() + 7);

            // Get the session open data
            const sessionSetupTxs = await getSessionEnableData({ sessionEnd });

            // Encode all of that in a multicall
            const txData = encodeWalletMulticall(
                sessionSetupTxs.map((tx) => ({
                    to: address,
                    data: tx,
                }))
            );

            // Send the open session calldata
            const openSessionTxHash = await sendTransactionAsync({
                to: address,
                data: txData,
            });

            console.log(`Open session tx hash: ${openSessionTxHash}`);

            // Send the pending interactions
            await consumePendingInteractions();

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: ["interactions", "session-status"],
                exact: false,
            });

            return {
                openSessionTxHash,
            };
        },
    });
}
