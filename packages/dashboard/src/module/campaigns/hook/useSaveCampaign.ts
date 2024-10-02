import { saveCampaignDraft } from "@/context/campaigns/action/createCampaign";
import { campaignAtom } from "@/module/campaigns/atoms/campaign";
import {
    campaignIsClosingAtom,
    campaignStepAtom,
} from "@/module/campaigns/atoms/steps";
import type { Campaign } from "@/types/Campaign";
import { useQueryClient } from "@tanstack/react-query";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";

export function useSaveCampaign() {
    const setCampaign = useSetAtom(campaignAtom);
    const campaignIsClosing = useAtomValue(campaignIsClosingAtom);
    const setStep = useSetAtom(campaignStepAtom);
    const queryClient = useQueryClient();
    const router = useRouter();

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
            setTimeout(() => router.push("/campaigns/list"), 0);
            return;
        }

        setStep((prev) => prev + 1);
    };
}
