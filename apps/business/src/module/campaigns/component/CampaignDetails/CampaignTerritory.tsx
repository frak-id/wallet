import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { capitalize } from "radash";
import { Badge } from "@/module/common/component/Badge";
import { Title } from "@/module/common/component/Title";
import type { Campaign } from "@/types/Campaign";

export function CampaignTerritory({ campaign }: { campaign: Campaign | null }) {
    if (!campaign?.metadata?.territories?.length) return null;

    return (
        <Stack space="m">
            <Title as={"h3"} size={"small"}>
                Territory
            </Title>
            <Inline space="m" alignY="top">
                {campaign.metadata.territories.map((territory: string) => (
                    <Badge key={territory} variant={"secondary"}>
                        {capitalize(territory)}
                    </Badge>
                ))}
            </Inline>
        </Stack>
    );
}
