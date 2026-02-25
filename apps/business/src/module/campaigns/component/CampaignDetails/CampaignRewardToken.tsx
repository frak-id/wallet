import type { Address } from "viem";
import { useTokenMetadata } from "@/module/common/hook/useTokenMetadata";
import { FormDescription, FormItem } from "@/module/forms/Form";
import type { Campaign } from "@/types/Campaign";

export function CampaignRewardToken({ campaign }: { campaign: Campaign }) {
    const firstToken = campaign.rule.rewards.find((r) => r.token)?.token as
        | Address
        | undefined;

    const { data: tokenMeta } = useTokenMetadata(firstToken);

    if (!firstToken || !tokenMeta) {
        return null;
    }

    return (
        <FormItem>
            <FormDescription label="Reward Token" />
            <span>
                {tokenMeta.symbol} ({tokenMeta.name})
            </span>
        </FormItem>
    );
}
