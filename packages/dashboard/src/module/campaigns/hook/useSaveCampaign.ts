import { saveCampaign } from "@/context/campaigns/action/createCampaign";
import {
    campaignAtom,
    campaignResetAtom,
} from "@/module/campaigns/atoms/campaign";
import {
    campaignIsClosingAtom,
    campaignStepAtom,
} from "@/module/campaigns/atoms/steps";
import type { Campaign } from "@/types/Campaign";
import { useAtomValue, useSetAtom } from "jotai";
import { useRouter } from "next/navigation";

export function useSaveCampaign() {
    const router = useRouter();
    const setCampaign = useSetAtom(campaignAtom);
    const campaignIsClosing = useAtomValue(campaignIsClosingAtom);
    const setStep = useSetAtom(campaignStepAtom);
    const campaignReset = useSetAtom(campaignResetAtom);

    return async function save(values: Campaign) {
        console.log(values);
        setCampaign(values);

        if (campaignIsClosing) {
            await saveCampaign(values);
            campaignReset();
            router.push("/campaigns");
            return;
        }

        setStep((prev) => prev + 1);
    };
}
