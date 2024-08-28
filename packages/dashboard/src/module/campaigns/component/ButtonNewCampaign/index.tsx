"use client";

import { Button } from "@module/component/Button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";

export function ButtonNewCampaign() {
    const router = useRouter();

    return (
        <Button
            leftIcon={<Plus size={20} />}
            onClick={() => router.push("/campaigns/new")}
        >
            Create Campaign
        </Button>
    );
}
