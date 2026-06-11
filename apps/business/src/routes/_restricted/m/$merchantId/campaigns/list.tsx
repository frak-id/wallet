import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import { TableCampaigns } from "@/module/campaigns/component/TableCampaigns";
import { CampaignsListFooter } from "@/module/campaigns/component/TableCampaigns/CampaignsListFooter";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import * as footerStyles from "@/module/common/component/FloatingFooter/floating-footer.css";
import { PageShell } from "@/module/common/component/PageShell";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/list"
)({
    loader: ({ params }) => {
        queryClient.prefetchQuery(
            campaignsListQueryOptions({
                merchantId: params.merchantId,
                isDemoMode: isDemoMode(),
            })
        );
    },
    component: CampaignsListPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaigns" />
    ),
});

function CampaignsListPage() {
    return (
        <div className={footerStyles.pageBottomSpacer}>
            <PageShell page="campaignsList">
                <TableCampaigns />
            </PageShell>
            <CampaignsListFooter />
        </div>
    );
}
