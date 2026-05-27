import { Plus } from "lucide-react";
import type { ComponentProps } from "react";
import { LinkButton } from "@/module/common/component/LinkButton";
import { useOptionalActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { campaignStore } from "@/stores/campaignStore";

type Props = {
    size?: ComponentProps<typeof LinkButton>["size"];
};

export function ButtonNewCampaign({ size }: Props = {}) {
    const reset = campaignStore((state) => state.reset);
    const merchantId = useOptionalActiveMerchantId();

    // The button only makes sense inside a `/m/$merchantId/...` context.
    if (!merchantId) return null;

    return (
        <LinkButton
            to="/m/$merchantId/campaigns/draft/new"
            params={{ merchantId }}
            onClick={() => reset()}
            size={size}
            icon={<Plus size={16} />}
        >
            Create new campaign
        </LinkButton>
    );
}
