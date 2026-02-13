import { Badge } from "@/module/common/component/Badge";
import type { CampaignStatus } from "@/types/Campaign";

/**
 * Display the campaign status
 * @param status
 * @constructor
 */
export function CampaignStateTag({ status }: { status: CampaignStatus }) {
    switch (status) {
        case "draft":
            return <Badge variant={"secondary"}>Draft</Badge>;
        case "active":
            return <Badge variant={"success"}>Active</Badge>;
        case "paused":
            return <Badge variant={"warning"}>Paused</Badge>;
        case "archived":
            return <Badge variant={"secondary"}>Archived</Badge>;
        default:
            return <Badge variant={"danger"}>Unknown</Badge>;
    }
}
