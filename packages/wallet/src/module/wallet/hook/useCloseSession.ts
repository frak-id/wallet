import { kernelAddresses } from "@/context/blockchain/addresses";
import { interactionSessionValidatorAbi } from "@/context/wallet/abi/kernel-v2-abis";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { encodeFunctionData } from "viem";
import { useSendTransaction } from "wagmi";

export function useCloseSession() {
    const queryClient = useQueryClient();
    const { sendTransactionAsync } = useSendTransaction();

    return useMutation({
        mutationKey: ["interactions", "close-session"],
        mutationFn: async () => {
            // Build the session disable data
            const disableCallData = encodeFunctionData({
                abi: interactionSessionValidatorAbi,
                functionName: "disable",
                args: ["0x"],
            });

            // Send the disable call
            const txHash = await sendTransactionAsync({
                to: kernelAddresses.interactionSessionValidator,
                data: disableCallData,
            });

            // Refresh the interactions stuff
            await queryClient.invalidateQueries({
                queryKey: ["interactions", "session-status"],
                exact: false,
            });

            return txHash;
        },
    });
}
