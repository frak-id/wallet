import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { TableCampaigns } from "@/module/campaigns/component/TableCampaigns";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { Breadcrumb } from "@/module/common/component/Breadcrumb";
import { Head } from "@/module/common/component/Head";
import { DataLoadError } from "@/module/common/component/RouteError";
import { queryClient } from "@/module/common/provider/RootProvider";

export const Route = createFileRoute("/_restricted/campaigns/list")({
    loader: () => {
        queryClient.prefetchQuery(campaignsListQueryOptions(isDemoMode()));
    },
    component: CampaignsListPage,
    errorComponent: (props) => (
        <DataLoadError {...props} resourceName="campaigns" />
    ),
});

function CampaignsListPage() {
    const { t } = useTranslation();
    return (
        <>
            <Head
                title={{ content: t("shell.nav.campaigns") }}
                leftSection={
                    <Breadcrumb current={t("shell.breadcrumb.campaignsList")} />
                }
            />
            <TableCampaigns />
        </>
    );
}
