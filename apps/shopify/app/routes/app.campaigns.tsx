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

type CampaignTransitionIntent =
    | "pause-campaign"
    | "resume-campaign"
    | "archive-campaign"
    | "delete-campaign";

type CampaignTransitionHandler = (
    context: AuthenticatedContext,
    request: Request,
    campaignId: string
) => Promise<unknown | null>;

const campaignTransitionHandlers: Record<
    CampaignTransitionIntent,
    { handler: CampaignTransitionHandler; error: string }
> = {
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
};

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

    if (
        intent === "pause-campaign" ||
        intent === "resume-campaign" ||
        intent === "archive-campaign" ||
        intent === "delete-campaign"
    ) {
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
    // Path prefix that targets the merchant-scoped business app routes when
    // we know the merchant id, otherwise falls back to the legacy path which
    // the business app redirects to the user's first merchant. The fallback
    // protects deep links generated before onboarding step 1 completes.
    // Routed through the Shopify SSO login entrypoint so the merchant doesn't
    // have to manually re-authenticate in the business app.
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
                // TODO: Link to the settings / setup instructions
                <p>Nope</p>
            )}
        </s-page>
    );
}
