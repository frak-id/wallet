import {
    addresses,
    getTokenAddressForStablecoin,
} from "@frak-labs/app-essentials";
import {
    campaignBankAbi,
    campaignBankFactoryAbi,
    type Stablecoin,
} from "@frak-labs/app-essentials/blockchain";
import {
    useSendTransactionAction,
    useWalletStatus,
} from "@frak-labs/react-sdk";
import { useMutation } from "@tanstack/react-query";
import {
    type Address,
    encodeFunctionData,
    isAddressEqual,
    zeroAddress,
} from "viem";
import { simulateContract } from "viem/actions";
import { viemClient } from "@/context/blockchain/provider";
import { useWaitForTxAndInvalidateQueries } from "@/module/common/utils/useWaitForTxAndInvalidateQueries";

export type AddProductBankParams = {
    productId: Address;
    stablecoin: Stablecoin;
};

/**
 * Hook to add a new bank to a product
 */
export function useAddProductBank() {
    const waitForTxAndInvalidateQueries = useWaitForTxAndInvalidateQueries();
    const { mutateAsync: sendTransaction } = useSendTransactionAction();
    const { data: walletStatus } = useWalletStatus();

    return useMutation({
        mutationKey: ["product", "bank", "add"],
        mutationFn: async ({ productId, stablecoin }: AddProductBankParams) => {
            if (!walletStatus?.wallet) {
                throw new Error("Wallet is not connected");
            }

            const stablecoinAddress = getTokenAddressForStablecoin(stablecoin);

            // Simulate the bank address
            const { result } = await simulateContract(viemClient, {
                account: walletStatus?.wallet,
                address: addresses.campaignBankFactory,
                abi: campaignBankFactoryAbi,
                functionName: "deployCampaignBank",
                args: [BigInt(productId), stablecoinAddress],
            });
            if (!result || isAddressEqual(result, zeroAddress)) {
                throw new Error("Failed to simulate bank deployment");
            }

            // Deploy the bank using the campaign bank factory
            const { hash } = await sendTransaction({
                tx: [
                    {
                        to: addresses.campaignBankFactory,
                        data: encodeFunctionData({
                            abi: campaignBankFactoryAbi,
                            functionName: "deployCampaignBank",
                            args: [BigInt(productId), stablecoinAddress],
                        }),
                    },
                    {
                        to: result,
                        data: encodeFunctionData({
                            abi: campaignBankAbi,
                            functionName: "updateDistributionState",
                            args: [true],
                        }),
                    },
                ],
            });

            // For now, just return a placeholder
            return hash;
        },
        onSuccess: async (hash) => {
            // Invalidate product related queries
            //  this also reset the top level `useGetProductFunding` query
            await waitForTxAndInvalidateQueries({
                hash,
                queryKey: ["product"],
            });
        },
    });
}
