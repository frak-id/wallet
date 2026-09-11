import { CampaignStatus } from "app/components/Campaign";
import { NewsletterShareLink } from "app/components/Sharing";
import { ExternalButton } from "app/components/ui/ExternalLink";
import { PageHeading } from "app/components/ui/PageHeading";
import type { loader as appLoader } from "app/routes/app";
import { authenticate } from "app/shopify.server";
import { buildBusinessDashboardUrl } from "app/utils/url";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData, useRouteLoaderData } from "react-router";
import {
    archiveMerchantCampaign,
    deleteMerchantCampaign,
    getMerchantBankStatus,
    getMerchantCampaigns,
    pauseMerchantCampaign,
    resumeMerchantCampaign,
} from "../services.server/backendMerchant";
import type { AuthenticatedContext } from "../types/context";

type CampaignActionResult = {
    success: boolean;
    error: string | null;
};

type CampaignTransitionHandler = (
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
) => Promise<unknown | null>;

const campaignTransitionHandlers = {
    "pause-campaign": {
        handler: pauseMerchantCampaign,
        error: "Failed to pause campaign",
    },
    "resume-campaign": {
        handler: resumeMerchantCampaign,
        error: "Failed to resume campaign",
    },
    "archive-campaign": {
        handler: archiveMerchantCampaign,
        error: "Failed to archive campaign",
    },
    "delete-campaign": {
        handler: deleteMerchantCampaign,
        error: "Failed to delete campaign",
    },
} satisfies Record<
    string,
    { handler: CampaignTransitionHandler; error: string }
>;

type CampaignTransitionIntent = keyof typeof campaignTransitionHandlers;

function isCampaignTransitionIntent(
    value: unknown
): value is CampaignTransitionIntent {
    return typeof value === "string" && value in campaignTransitionHandlers;
}

async function handleCampaignTransition(
    context: AuthenticatedContext,
    request: Request,
    formData: FormData,
    intent: CampaignTransitionIntent
): Promise<CampaignActionResult> {
    const campaignId = formData.get("campaignId");
    if (typeof campaignId !== "string" || !campaignId) {
        return {
            success: false,
            error: "Missing campaignId",
        };
    }

    const action = campaignTransitionHandlers[intent];
    const result = await action.handler(context, request, campaignId);

    return {
        success: Boolean(result),
        error: result ? null : action.error,
    };
}

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [campaigns, bankStatus] = await Promise.all([
        getMerchantCampaigns(context, request),
        getMerchantBankStatus(context, request),
    ]);
    return data({ campaigns, bankStatus });
};

export async function action({ request }: ActionFunctionArgs) {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");

    if (isCampaignTransitionIntent(intent)) {
        return data(
            await handleCampaignTransition(context, request, formData, intent)
        );
    }

    return data({ success: false, error: "Unknown intent" });
}

export default function CampaignsPage() {
    const { campaigns, bankStatus } = useLoaderData<typeof loader>();
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const businessUrl = rootData?.businessUrl ?? "";
    const merchantId = rootData?.merchantId;
    const shopDomain = rootData?.shop?.myshopifyDomain;
    // Without a merchant id (deep link generated before onboarding step 1), the
    // business app redirects `/campaigns` to the user's first merchant.
    const campaignsPathPrefix = merchantId
        ? `/m/${merchantId}/campaigns`
        : "/campaigns";
    const viewAllUrl = buildBusinessDashboardUrl({
        businessUrl,
        shop: shopDomain,
        target: `${campaignsPathPrefix}/list`,
    });
    const createNewUrl = buildBusinessDashboardUrl({
        businessUrl,
        shop: shopDomain,
        target: `${campaignsPathPrefix}/draft/new`,
    });
    const { t } = useTranslation();

    return (
        <s-page heading={t("campaigns.title")}>
            <s-stack
                direction="inline"
                gap="base"
                justifyContent="space-between"
                alignItems="center"
            >
                <PageHeading>{t("campaigns.title")}</PageHeading>
                <s-stack direction="inline" gap="base">
                    <ExternalButton href={viewAllUrl}>
                        {t("campaigns.viewAll")}
                    </ExternalButton>
                    <ExternalButton variant="primary" href={createNewUrl}>
                        {t("campaigns.createNew")}
                    </ExternalButton>
                </s-stack>
            </s-stack>
            {campaigns && bankStatus ? (
                <s-stack gap="large">
                    <CampaignStatus campaigns={campaigns} />
                    <NewsletterShareLink />
                </s-stack>
            ) : (
                <s-section>
                    <s-banner tone="warning">
                        <s-text>
                            {t("common.dashboardDataUnavailableTitle")}
                        </s-text>
                        <s-text>
                            {t("common.dashboardDataUnavailableDescription")}
                        </s-text>
                    </s-banner>
                </s-section>
            )}
        </s-page>
    );
}
