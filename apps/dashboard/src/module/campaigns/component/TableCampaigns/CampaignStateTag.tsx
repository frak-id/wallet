import { Badge } from "@/module/common/component/Badge";
import type { CampaignState } from "@/types/Campaign";
import { Tooltip } from "@frak-labs/ui/component/Tooltip";

/**
 * If state == created, display additional badges (isActive, isAttached)
 * @param state
 * @constructor
 */
export function CampaignStateTag({ state }: { state: CampaignState }) {
    // Draft and creationFailed are simple badges
    if (state.key === "draft") {
        return <Badge variant={"secondary"}>Draft</Badge>;
    }
    if (state.key !== "created") {
        return <Badge variant={"danger"}>Setup failed</Badge>;
    }

    // Check if the campaign is running
    if (!state.isRunning) {
        return <Badge variant="primary">Paused</Badge>;
    }

    // Check if the campaign is active
    if (!state.isActive) {
        return (
            <Tooltip
                content={
                    "The campaign isn't active, check the funding and the activation date to enable it"
                }
            >
                <Badge variant="danger">Stopped</Badge>
            </Tooltip>
        );
    }

    // Check if for any reason it can't be executed
    if (!state.interactionLink?.isAttached) {
        return (
            <Tooltip
                content={
                    "The campaign is stopped since it's not attached to the user interactions"
                }
            >
                <Badge variant="danger">Stopped</Badge>
            </Tooltip>
        );
    }

    // If we are here, all good
    return <Badge variant="success">Running</Badge>;
}
