"use client";

import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Filters } from "@/module/common/component/Filters";
import { Head } from "@/module/common/component/Head";
import { Button } from "@module/component/Button";
import { Plus } from "lucide-react";
import { useRouter } from "next/navigation";
import { TableCampaignPerformance } from "../../../../module/campaigns/component/TableCampaignPerformance";

export default function CampaignsPerformancePage() {
    const router = useRouter();

    return (
        <>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={
                    <Button
                        leftIcon={<Plus size={20} />}
                        onClick={() => router.push("/campaigns/new")}
                    >
                        Create Campaign
                    </Button>
                }
            />
            <Filters />
            <TableCampaignPerformance />
        </>
    );
}
