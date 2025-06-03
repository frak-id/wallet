import { viemClient } from "@/context/blockchain/provider";
import { useGetOnChainCampaignDetails } from "@/module/campaigns/hook/useGetOnChainDetails";
import { Title } from "@/module/common/component/Title";
import { campaignBankAbi } from "@frak-labs/app-essentials/blockchain";
import { useQuery } from "@tanstack/react-query";
import Link from "next/link";
import { type Address, erc20Abi } from "viem";
import { multicall } from "viem/actions";
import { useConvertToPreferredCurrency } from "../../../common/hook/useConversionRate";

/**
 * Display the campaign balance
 * @param campaignAddress
 * @constructor
 */
export function CampaignBank({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    const { data: onChainInfos } = useGetOnChainCampaignDetails({
        campaignAddress,
    });

    const { data: bankInfo, isLoading } = useQuery({
        enabled: !!onChainInfos,
        queryKey: ["campaign", "bank-info", campaignAddress],
        queryFn: async () => {
            const bank = onChainInfos?.config?.[2];
            if (!bank) {
                return null;
            }

            const [bankToken, canDistributeToken] = await multicall(
                viemClient,
                {
                    contracts: [
                        {
                            abi: campaignBankAbi,
                            address: bank,
                            functionName: "getToken",
                        },
                        {
                            abi: campaignBankAbi,
                            address: bank,
                            functionName: "canDistributeToken",
                            args: [campaignAddress],
                        },
                    ] as const,
                    allowFailure: false,
                }
            );

            // Otherwise, fetch a few bank infos, like token and balance
            const [balance, symbol, decimal] = await multicall(viemClient, {
                contracts: [
                    {
                        address: bankToken,
                        abi: erc20Abi,
                        functionName: "balanceOf",
                        args: [bank],
                    },
                    {
                        address: bankToken,
                        abi: erc20Abi,
                        functionName: "symbol",
                    },
                    {
                        address: bankToken,
                        abi: erc20Abi,
                        functionName: "decimals",
                    },
                ] as const,
                allowFailure: false,
            });

            return {
                bankToken,
                canDistributeToken,
                balance,
                symbol,
                decimal,
            };
        },
    });

    const formattedBalance = useConvertToPreferredCurrency({
        balance: bankInfo?.balance,
        decimals: bankInfo?.decimal,
        token: bankInfo?.bankToken,
    });

    if (isLoading || !bankInfo) {
        return null;
    }

    return (
        <>
            <Title as={"h3"} size={"small"}>
                Bank
            </Title>
            <p>
                Can distribute token:{" "}
                {bankInfo.canDistributeToken ? "Yes" : "No"}
            </p>
            <p>Current bank balance: {formattedBalance}</p>
            <p>
                <Link href={`/product/${onChainInfos?.productId}/funding`}>
                    Check bank
                </Link>
            </p>
        </>
    );
}
