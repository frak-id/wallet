import { getOnChainCampaignsDetails } from "@/context/campaigns/action/getDetails";
import { Title } from "@/module/common/component/Title";
import { backendApi } from "@frak-labs/shared/context/server/backendClient";
import { Button } from "@module/component/Button";
import { useMutation, useQuery } from "@tanstack/react-query";
import { sleep } from "radash";
import { type Address, formatEther } from "viem";

/**
 * Display the campaign balance
 * @param campaignAddress
 * @constructor
 */
export function CampaignBalance({
    campaignAddress,
}: {
    campaignAddress: Address;
}) {
    const {
        data: onChainInfos,
        isLoading,
        refetch: refreshOnChainInfos,
    } = useQuery({
        queryKey: ["campaign", "on-chain-details", campaignAddress],
        queryFn: () => getOnChainCampaignsDetails({ campaignAddress }),
    });

    const { mutate: addFundRequest, isPending: isAddingFund } = useMutation({
        mutationKey: ["campaign", "add-fund", campaignAddress],
        mutationFn: async () => {
            // Launch the request
            await backendApi.business.funding.freeReload.post({
                campaign: campaignAddress,
            });
            // Wait a bit
            await sleep(5_000);
            // Refresh on chain info
            await refreshOnChainInfos();
        },
    });

    if (isLoading || !onChainInfos) {
        return null;
    }

    return (
        <>
            <Title as={"h3"} size={"small"}>
                Balance
            </Title>
            <p>
                Your current balance:{" "}
                {formatEther(BigInt(onChainInfos.balance))}
            </p>
            <p>
                <Button
                    variant={"submit"}
                    isLoading={isAddingFund}
                    disabled={isAddingFund}
                    onClick={() => addFundRequest()}
                >
                    Add Funds
                </Button>
            </p>
        </>
    );
}
