import { viemClient } from "@/context/common/blockchain/provider";
import { triggerFrkAirdrop } from "@/context/mock/action/airdropFrk";
import { useMutation } from "@tanstack/react-query";
import type { Address } from "viem";
import { waitForTransactionReceipt } from "viem/actions";

/**
 * Hook that handle the airdrop frk
 */
export function useAirdropFrk() {
    const { isPending: isAirdroppingFrk, mutateAsync: airdropFrk } =
        useMutation({
            mutationKey: ["airdropFrk"],
            mutationFn: async ({ wallet }: { wallet: Address }) => {
                // Trigger the airdrop
                const { txHash } = await triggerFrkAirdrop({
                    user: wallet,
                    amount: "100",
                });
                // Wait for the tx receipt
                await waitForTransactionReceipt(viemClient, {
                    hash: txHash,
                    confirmations: 1,
                });
                // Return the tx hash
                return txHash;
            },
        });

    return {
        isAirdroppingFrk,
        airdropFrk,
    };
}
