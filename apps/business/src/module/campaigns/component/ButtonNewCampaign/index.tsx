import { Plus } from "lucide-react";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonNewCampaign() {
    const reset = campaignStore((state) => state.reset);
    const merchantId = useOptionalActiveMerchantId();

    // The button only makes sense inside a `/m/$merchantId/...` context.
    if (!merchantId) return null;

    return (
        <LinkButton
            to="/m/$merchantId/campaigns/draft/new"
            params={{ merchantId }}
            onClick={() => reset()}
            icon={<Plus size={16} />}
        >
            Create new campaign
        </LinkButton>
    );
}
