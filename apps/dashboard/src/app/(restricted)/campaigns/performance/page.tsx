"use client";

import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { CampaignFunnel } from "@/module/campaigns/component/CampaignFunnel";
import { TableCampaignPerformance } from "@/module/campaigns/component/TableCampaignPerformance";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { useHydrated } from "@/module/common/hook/useHydrated";

export default function CampaignsPerformancePage() {
    const isDemoMode = useIsDemoMode();
    const isHydrated = useHydrated();

    return (
        <>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={<ButtonNewCampaign />}
            />
            <TableCampaignPerformance />
            {isHydrated && isDemoMode && <CampaignFunnel />}
        </>
    );
}
