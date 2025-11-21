import { Plus } from "lucide-react";
import { LinkButton } from "@/module/common/component/LinkButton";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonNewCampaign() {
    const reset = campaignStore((state) => state.reset);

    return (
        <LinkButton
            to="/campaigns/new"
            onClick={() => reset()}
            leftIcon={<Plus size={20} />}
        >
            Create Campaign
        </LinkButton>
    );
}
