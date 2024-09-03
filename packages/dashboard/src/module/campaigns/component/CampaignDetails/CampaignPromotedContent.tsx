import type { CampaignDocument } from "@/context/campaigns/dto/CampaignDocument";
import { Badge } from "@/module/common/component/Badge";
import { Column } from "@/module/common/component/Column";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import type { WithId } from "mongodb";
import { capitalize } from "radash";

/**
 * Display the campaign promoted product
 * @param campaign
 * @constructor
 */
export function CampaignPromotedContent({
    campaign,
}: { campaign: WithId<CampaignDocument> }) {
    if (!campaign?.promotedContents?.length) return null;

    return (
        <Column fullWidth={true}>
            <Title as={"h3"} size={"small"}>
                Promoted Content
            </Title>
            <Row align={"start"}>
                {campaign.promotedContents.map((content) => (
                    <Badge key={content} variant={"secondary"}>
                        {capitalize(content)}
                    </Badge>
                ))}
            </Row>
        </Column>
    );
}