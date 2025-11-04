import { createFileRoute } from "@tanstack/react-router";
import { requireAuth } from "@/middleware/auth";
import { ButtonNewCampaign } from "@/module/campaigns/component/ButtonNewCampaign";
import { TableCampaignPerformance } from "@/module/campaigns/component/TableCampaignPerformance";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { RestrictedLayout } from "@/module/common/component/RestrictedLayout";

export const Route = createFileRoute("/campaigns/performance")({
    beforeLoad: requireAuth,
    component: CampaignsPerformancePage,
});

function CampaignsPerformancePage() {
    return (
        <RestrictedLayout>
            <Head
                title={{ content: "Campaigns" }}
                leftSection={<Breadcrumb current={"Campaign List"} />}
                rightSection={<ButtonNewCampaign />}
            />
            <TableCampaignPerformance />
        </RestrictedLayout>
    );
}
