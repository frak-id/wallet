import { frakChainId } from "@/context/blockchain/provider";
import { isRunningInProd } from "@/context/common/env";
import { triggerFrkAirdrop } from "@/context/mock/action/airdropFrk";
import { useMutation } from "@tanstack/react-query";
import type { Address } from "viem";
import { waitForTransactionReceipt } from "viem/actions";
import { useClient } from "wagmi";

/**
 * Hook that handle the airdrop frk
 */
export function useAirdropFrk() {
    const viemClient = useClient({ chainId: frakChainId });

    // Airdrop the FRK and wait for the receipt if needed
    const { isPending: isAirdroppingFrk, mutateAsync: airdropFrk } =
        useMutation({
            mutationKey: ["airdropFrk"],
            mutationFn: async ({
                wallet,
                waitForReceipt,
            }: { wallet: Address; waitForReceipt: boolean }) => {
                // If in prod don't airdrop frk
                if (isRunningInProd) {
                    console.log("Not airdropping FRK in prod");
                    return null;
                }

                // Trigger the airdrop
                const txHash = await triggerFrkAirdrop({
                    user: wallet,
                    amount: "100",
                });
                // Wait for the tx receipt
                if (waitForReceipt && viemClient && txHash) {
                    await waitForTransactionReceipt(viemClient, {
                        hash: txHash,
                        confirmations: 1,
                    });
                }
                // Return the tx hash
                return txHash;
            },
        });

    return {
        isAirdroppingFrk,
        airdropFrk,
    };
}
