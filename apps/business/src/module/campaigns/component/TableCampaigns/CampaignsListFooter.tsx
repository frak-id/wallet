import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { FloatingFooter } from "@/module/common/component/FloatingFooter";

/**
 * Floating bottom bar with the "Create new campaign" CTA. Pinned to the
 * viewport so it stays visible while the campaign list scrolls underneath.
 */
export function CampaignsListFooter() {
    return (
        <FloatingFooter>
            <ButtonNewCampaign size="large" />
        </FloatingFooter>
    );
}
