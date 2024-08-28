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
import { useRouter } from "next/navigation";

export function useSaveCampaign() {
    const router = useRouter();
    const setCampaign = useSetAtom(campaignAtom);
    const campaignIsClosing = useAtomValue(campaignIsClosingAtom);
    const setStep = useSetAtom(campaignStepAtom);
    const campaignReset = useSetAtom(campaignResetAtom);
    const queryClient = useQueryClient();

    return async function save(values: Campaign) {
        console.log(values);
        setCampaign(values);

        if (campaignIsClosing) {
            const { id } = await saveCampaignDraft(values);
            if (id) {
                setCampaign({ ...values, id });
                // Invalidate my campaigns query
                await queryClient.invalidateQueries({
                    queryKey: ["campaigns", "my-campaigns"],
                });
            }
            campaignReset();
            router.push("/campaigns");
            return;
        }

        setStep((prev) => prev + 1);
    };
}
