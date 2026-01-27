import { capitalize } from "radash";
import { Badge } from "@/module/common/component/Badge";
import { Column } from "@/module/common/component/Column";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import type { Campaign } from "@/types/Campaign";

export function CampaignTerritory({ campaign }: { campaign: Campaign | null }) {
    if (!campaign?.metadata?.territories?.length) return null;

    return (
        <Column fullWidth={true}>
            <Title as={"h3"} size={"small"}>
                Territory
            </Title>
            <Row align={"start"}>
                {campaign.metadata.territories.map((territory) => (
                    <Badge key={territory} variant={"secondary"}>
                        {capitalize(territory)}
                    </Badge>
                ))}
            </Row>
        </Column>
    );
}
