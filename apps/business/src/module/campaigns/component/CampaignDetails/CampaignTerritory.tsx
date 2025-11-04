import { capitalize } from "radash";
import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { Badge } from "@/module/common/component/Badge";
import { Column } from "@/module/common/component/Column";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";

/**
 * Display the campaign territory
 * @param campaign
 * @constructor
 */
export function CampaignTerritory({
    campaign,
}: {
    campaign: CampaignDocument | null;
}) {
    if (!campaign?.territories?.length) return null;

    return (
        <Column fullWidth={true}>
            <Title as={"h3"} size={"small"}>
                Territory
            </Title>
            <Row align={"start"}>
                {campaign.territories.map((territory) => (
                    <Badge key={territory} variant={"secondary"}>
                        {capitalize(territory)}
                    </Badge>
                ))}
            </Row>
        </Column>
    );
}
