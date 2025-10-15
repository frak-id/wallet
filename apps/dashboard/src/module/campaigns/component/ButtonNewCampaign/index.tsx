"use client";

import { Button } from "@frak-labs/ui/component/Button";
import { useSetAtom } from "jotai/index";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";

export function ButtonNewCampaign() {
    const router = useRouter();
    const campaignReset = useSetAtom(campaignResetAtom);

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => {
                campaignReset();
                router.push("/campaigns/new");
            }}
        >
            Create Campaign
        </Button>
    );
}
