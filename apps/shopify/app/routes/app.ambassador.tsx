import { AmbassadorPageScreen } from "app/components/AmbassadorPage";
import { PageHeading } from "app/components/ui/PageHeading";
import {
    addAmbassadorMenuLink,
    getAmbassadorPageOverview,
    hideAmbassadorPage,
    probeAmbassadorPage,
    publishAmbassadorPage,
    switchToFullWidthPage,
} from "app/services.server/ambassadorPage";
import { getMerchantCampaigns } from "app/services.server/backendMerchant";
import { log } from "app/services.server/logger";
import { resolveMerchantId } from "app/services.server/merchant";
import { shopInfo } from "app/services.server/shop";
import { authenticate } from "app/shopify.server";
import {
    type AmbassadorPageActionResult,
    type AmbassadorPageIntent,
    ambassadorPageLanguage,
} from "app/utils/ambassadorPage";
import { buildBusinessDashboardUrl } from "app/utils/url";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { useLoaderData } from "react-router";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [overview, campaigns, merchantId, shop] = await Promise.all([
        getAmbassadorPageOverview(context),
        getMerchantCampaigns(context, request).catch((err) => {
            log.error({ err }, "ambassador loader: campaigns failed");
            return null;
        }),
        resolveMerchantId(context).catch((err) => {
            log.error({ err }, "ambassador loader: merchant id failed");
            return null;
        }),
        shopInfo(context).catch((err) => {
            log.error({ err }, "ambassador loader: shop info failed");
            return null;
        }),
    ]);

    const businessUrl = process.env.BUSINESS_URL || "https://business.frak.id";
    return {
        overview,
        hasActiveCampaign: campaigns
            ? campaigns.campaigns.some(
                  (campaign) => campaign.status === "active"
              )
            : null,
        customizeUrl: merchantId
            ? buildBusinessDashboardUrl({
                  businessUrl,
                  shop: shop?.myshopifyDomain,
                  target: `/m/${merchantId}/merchant/customize`,
              })
            : null,
        // Streamed: the storefront fetch must never hold the page back.
        probePromise:
            overview?.status === "live"
                ? probeAmbassadorPage(overview.url)
                : null,
    };
};

export type AmbassadorLoaderData = Awaited<ReturnType<typeof loader>>;

const INTENTS: readonly AmbassadorPageIntent[] = [
    "publish",
    "hide",
    "addToMenu",
    "switch",
];

function isIntent(value: unknown): value is AmbassadorPageIntent {
    return INTENTS.some((intent) => intent === value);
}

/** `addToMenu` is `"true"`, `"false"` or absent (false); anything else is invalid. */
function parseAddToMenu(value: FormDataEntryValue | null): boolean | null {
    if (value === null || value === "false") return false;
    return value === "true" ? true : null;
}

export async function action({
    request,
}: ActionFunctionArgs): Promise<AmbassadorPageActionResult> {
    const context = await authenticate.admin(request);
    const formData = await request.formData();
    const intent = formData.get("intent");
    const addToMenu = parseAddToMenu(formData.get("addToMenu"));
    if (!isIntent(intent) || addToMenu === null) {
        return {
            ok: false,
            intent: isIntent(intent) ? intent : "publish",
            error: "invalid",
        };
    }

    const languageField = formData.get("language");
    const language = ambassadorPageLanguage(
        typeof languageField === "string" ? languageField : null
    );
    switch (intent) {
        case "publish":
            return publishAmbassadorPage(context, { addToMenu, language });
        case "hide":
            return hideAmbassadorPage(context);
        case "addToMenu":
            return addAmbassadorMenuLink(context, { language });
        case "switch":
            return switchToFullWidthPage(context, { addToMenu, language });
    }
}

export type AmbassadorActionData = Awaited<ReturnType<typeof action>>;

export default function AmbassadorPage() {
    const { t } = useTranslation();
    const { overview, hasActiveCampaign, customizeUrl, probePromise } =
        useLoaderData<typeof loader>();

    return (
        <s-page heading={t("ambassadorPage.title")}>
            <PageHeading>{t("ambassadorPage.title")}</PageHeading>
            <AmbassadorPageScreen
                overview={overview}
                hasActiveCampaign={hasActiveCampaign}
                customizeUrl={customizeUrl}
                probePromise={probePromise}
            />
        </s-page>
    );
}
