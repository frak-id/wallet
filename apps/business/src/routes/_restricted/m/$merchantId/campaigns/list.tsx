import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { isDemoMode } from "@/config/auth";
import { TableCampaigns } from "@/module/campaigns/component/TableCampaigns";
import { campaignsListQueryOptions } from "@/module/campaigns/queries/queryOptions";
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
    const { t } = useTranslation();
    return (
        <Stack space="xxl">
            <Text as="h1" variant="heading1" weight="bold">
                {t("shell.breadcrumb.campaignsList")}
            </Text>
            <TableCampaigns />
        </Stack>
    );
}
