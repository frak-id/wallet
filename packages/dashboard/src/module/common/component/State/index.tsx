import { Badge } from "@/module/common/component/Badge";
import type { CampaignState } from "@/types/Campaign";
import { capitalize } from "radash";

const mapStateToBadgeVariant = {
    draft: "secondary",
    creationFailed: "danger",
    created: "success",
} as const;

export function State({ state }: { state: CampaignState }) {
    return (
        <Badge variant={mapStateToBadgeVariant[state.key]}>
            {capitalize(state.key)}
        </Badge>
    );
}
