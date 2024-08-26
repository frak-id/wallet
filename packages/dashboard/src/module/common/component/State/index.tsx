import { Badge } from "@/module/common/component/Badge";
import type { CampaignState } from "@/types/Campaign";
import { capitalize } from "radash";

const mapStateToBadgeVariant = {
    draft: "secondary",
    creationFailed: "danger",
    created: "success",
} as const;

/**
 * If state == created, display additional badges (isActive, isAttached)
 * @param state
 * @constructor
 */
export function State({ state }: { state: CampaignState }) {
    if (state.key !== "created") {
        return (
            <Badge variant={mapStateToBadgeVariant[state.key]}>
                {capitalize(state.key)}
            </Badge>
        );
    }

    return (
        <>
            <Badge variant={mapStateToBadgeVariant[state.key]}>
                {capitalize(state.key)}
            </Badge>
            {/*Active badges*/}
            <Badge variant="information">
                {state.isActive === true ? "Active" : "Not active"}
            </Badge>
            {/*Attachment badges*/}
            <Badge variant="information">
                {state.interactionLink?.isAttached === true
                    ? "Attached"
                    : "Not attached"}
            </Badge>
        </>
    );
}
