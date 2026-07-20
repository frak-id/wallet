import { PencilIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import { LinkButton } from "@/module/common/component/LinkButton";
import { campaignStore } from "@/stores/campaignStore";

type Props = {
    merchantId: string;
    campaignId: string;
};

/**
 * Prominent edit affordance for draft campaigns, shown in the details sheet
 * header so it is easy to find. Navigates to the draft edit flow and resets
 * any in-progress campaign draft first.
 */
export function EditCampaignButton({ merchantId, campaignId }: Props) {
    const { t } = useTranslation();
    const reset = campaignStore((state) => state.reset);
    return (
        <LinkButton
            variant="primary"
            size="small"
            icon={<PencilIcon width={16} height={16} />}
            to="/m/$merchantId/campaigns/draft/$campaignId"
            params={{ merchantId, campaignId }}
            onClick={() => reset()}
        >
            {t("campaigns.rowMenu.edit")}
        </LinkButton>
    );
}
