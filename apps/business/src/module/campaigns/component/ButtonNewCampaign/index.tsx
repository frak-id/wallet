import { Plus } from "lucide-react";
import { LinkButton } from "@/module/common/component/LinkButton";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonNewCampaign() {
    const reset = campaignStore((state) => state.reset);

    return (
        <LinkButton
            to="/campaigns/draft/new"
            onClick={() => reset()}
            icon={<Plus size={16} />}
        >
            Create new campaign
        </LinkButton>
    );
}
