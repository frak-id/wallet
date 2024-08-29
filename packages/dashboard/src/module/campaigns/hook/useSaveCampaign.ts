import { saveCampaignDraft } from "@/context/campaigns/action/createCampaign";
import {
    campaignAtom,
    campaignResetAtom,
} from "@/module/campaigns/atoms/campaign";
import {
    campaignIsClosingAtom,
    campaignStepAtom,
} from "@/module/campaigns/atoms/steps";
import type { Campaign } from "@/types/Campaign";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";

export function useSaveCampaign() {
    const setCampaign = useSetAtom(campaignAtom);
    const campaignIsClosing = useAtomValue(campaignIsClosingAtom);
    const setStep = useSetAtom(campaignStepAtom);
    const campaignReset = useSetAtom(campaignResetAtom);
    const queryClient = useQueryClient();

    return async function save(values: Campaign) {
        setCampaign(values);

        if (campaignIsClosing) {
            const { id } = await saveCampaignDraft(values);
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
            campaignReset();
            // router.push("/campaigns/list");
            // Weird bug, not redirected with router.push
            window.location.href = "/campaigns/list";
            return;
        }

        setStep((prev) => prev + 1);
    };
}
