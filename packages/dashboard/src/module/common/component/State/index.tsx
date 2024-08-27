import { Badge } from "@/module/common/component/Badge";
import { TooltipTable } from "@/module/common/component/TooltipTable";
import type { CampaignState } from "@/types/Campaign";

/**
 * If state == created, display additional badges (isActive, isAttached)
 * @param state
 * @constructor
 */
export function State({ state }: { state: CampaignState }) {
    // Draft and creationFailed are simple badges
    if (state.key === "draft") {
        return <Badge variant={"secondary"}>Draft</Badge>;
    }
    if (state.key !== "created") {
        return <Badge variant={"danger"}>Setup failed</Badge>;
    }

    // Check if the campaign is active
    if (!state.isActive) {
        return (
            <TooltipTable
                content={
                    "The campaign isn't active, check the funding and the activation date to enable it"
                }
            >
                <Badge variant="danger">Stopped</Badge>
            </TooltipTable>
        );
    }

    // Check if for any reason it can't be executed
    if (!state.interactionLink?.isAttached) {
        return (
            <TooltipTable
                content={
                    "The campaign is stopped since it's not attached to the user interactions"
                }
            >
                <Badge variant="danger">Stopped</Badge>
            </TooltipTable>
        );
    }

    // Check if the campaign is running
    if (!state.isRunning) {
        return <Badge variant="primary">Paused</Badge>;
    }

    // If we are here, all good
    return <Badge variant="success">Running</Badge>;
}
