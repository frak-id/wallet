"use client";

import { Button } from "@frak-labs/ui/component/Button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { campaignStore } from "@/stores/campaignStore";

export function ButtonNewCampaign() {
    const router = useRouter();
    const reset = campaignStore((state) => state.reset);

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => {
                reset();
                router.push("/campaigns/new");
            }}
        >
            Create Campaign
        </Button>
    );
}
