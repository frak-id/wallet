import type { ErrorComponentProps } from "@tanstack/react-router";
import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { NewCampaign } from "@/module/campaigns/component/Creation/NewCampaign";
import { RouteError } from "@/module/common/component/RouteError";

export const Route = createFileRoute(
    "/_restricted/m/$merchantId/campaigns/draft/new"
)({
    staticData: { shell: "bare" },
    component: CampaignsDraftNewPage,
    errorComponent: CampaignsDraftNewError,
});

function CampaignsDraftNewError(props: ErrorComponentProps) {
    const { t } = useTranslation();
    return (
        <RouteError
            {...props}
            title={t("errors.campaignCreate.title")}
            fallbackPath="/dashboard"
            fallbackLabel={t("errors.campaignCreate.back")}
        />
    );
}

function CampaignsDraftNewPage() {
    return <NewCampaign />;
}
