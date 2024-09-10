import { Badge } from "@/module/common/component/Badge";
import { Column } from "@/module/common/component/Column";
import { Row } from "@/module/common/component/Row";
import { Title } from "@/module/common/component/Title";
import type { Campaign } from "@/types/Campaign";
import { capitalize } from "radash";

/**
 * Display the campaign promoted product
 * @param promotedContents
 * @constructor
 */
export function CampaignPromotedContent({
    promotedContents,
}: { promotedContents: Campaign["promotedContents"] }) {
    if (!promotedContents.length) return null;

    return (
        <Column fullWidth={true}>
            <Title as={"h3"} size={"small"}>
                Promoted Content
            </Title>
            <Row align={"start"}>
                {promotedContents.map((content) => (
                    <Badge key={content} variant={"secondary"}>
                        {capitalize(content)}
                    </Badge>
                ))}
            </Row>
        </Column>
    );
}
