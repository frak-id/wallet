"use client";

import { campaignResetAtom } from "@/module/campaigns/atoms/campaign";
import { Button } from "@shared/module/component/Button";
import { useSetAtom } from "jotai/index";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

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
