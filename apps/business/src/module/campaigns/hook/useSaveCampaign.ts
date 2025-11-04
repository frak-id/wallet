import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { saveCampaignDraft } from "@/context/campaigns/action/createCampaign";
import { campaignStore } from "@/stores/campaignStore";
import type { Campaign } from "@/types/Campaign";

export function useSaveCampaign() {
    const setCampaign = campaignStore((state) => state.setCampaign);
    const setStep = campaignStore((state) => state.setStep);
    const campaignIsClosing = campaignStore((state) => state.isClosing);
    const queryClient = useQueryClient();
    const navigate = useNavigate();

    return async function save(values: Campaign) {
        setCampaign(values);

        if (campaignIsClosing) {
            const { id } = await saveCampaignDraft({
                data: { campaign: values },
            });
            if (id) {
                setCampaign({ ...values, id });
                // Invalidate my campaigns query
                await queryClient.invalidateQueries({
                    queryKey: ["campaigns", "my-campaigns"],
                });
                // Invalidate campaign query
                await queryClient.invalidateQueries({
                    queryKey: ["campaign", id],
                });
            }
            setTimeout(() => navigate({ to: "/campaigns/list" }), 0);
            return;
        }

        setStep((prev) => prev + 1);
    };
}
