import { createFileRoute } from "@tanstack/react-router";
import { isDemoMode } from "@/config/auth";
import {
    CAMPAIGN_DETAILS_TABS,
    type CampaignDetailsTab,
} from "@/module/campaigns/component/CampaignDetailsSheet";
import { TableCampaigns } from "@/module/campaigns/component/TableCampaigns";
import { CampaignsListFooter } from "@/module/campaigns/component/TableCampaigns/CampaignsListFooter";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import * as footerStyles from "@/module/common/component/FloatingFooter/floating-footer.css";
import { PageShell } from "@/module/common/component/PageShell";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";

type CampaignsListSearch = {
    campaign?: string;
    tab?: CampaignDetailsTab;
};

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/list"
)({
    validateSearch: (search: Record<string, unknown>): CampaignsListSearch => ({
        campaign:
            typeof search.campaign === "string" ? search.campaign : undefined,
        tab: CAMPAIGN_DETAILS_TABS.includes(search.tab as CampaignDetailsTab)
            ? (search.tab as CampaignDetailsTab)
            : undefined,
    }),
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
