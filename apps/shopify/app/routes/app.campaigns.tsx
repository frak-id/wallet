import { CampaignStatus } from "app/components/Campaign";
import { PageHeading } from "app/components/ui/PageHeading";
import { authenticate } from "app/shopify.server";
import { buildCampaignRule } from "app/utils/campaignCreation";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import {
    createMerchantCampaign,
    getMerchantBankStatus,
    getMerchantCampaigns,
    publishMerchantCampaign,
} from "../services.server/backendMerchant";

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

    if (intent === "create-campaign") {
        const name = formData.get("name") as string;
        const globalBudget = Number(formData.get("globalBudget"));
        const rawCAC = Number(formData.get("rawCAC"));
        const ratio = Number(formData.get("ratio"));

        if (!name || !globalBudget || !rawCAC || !ratio) {
            return data({
                success: false,
                error: "Missing required campaign fields",
            });
        }

        const rule = buildCampaignRule({ cacBrut: rawCAC, ratio });

        const campaign = await createMerchantCampaign(context, request, {
            name,
            rule,
            budgetConfig: [
                {
                    label: "global",
                    durationInSeconds: null,
                    amount: globalBudget,
                },
            ],
            metadata: {
                goal: undefined,
                specialCategories: [],
                territories: [],
            },
            priority: 0,
        });

        if (!campaign) {
            return data({
                success: false,
                error: "Failed to create campaign",
            });
        }

        const published = await publishMerchantCampaign(
            context,
            request,
            campaign.id
        );

        if (!published) {
            return data({
                success: false,
                error: "Campaign created but failed to publish",
            });
        }

        return data({ success: true, error: null });
    }

    return data({ success: false, error: "Unknown intent" });
}

export default function CampaignsPage() {
    const { campaigns, bankStatus } = useLoaderData<typeof loader>();
    const { t } = useTranslation();

    return (
        <s-page heading={t("campaigns.title")}>
            <PageHeading>{t("campaigns.title")}</PageHeading>
            {campaigns && bankStatus ? (
                <CampaignStatus campaigns={campaigns} bankStatus={bankStatus} />
            ) : (
                // TODO: Link to the settings / setup instructions
                <p>Nope</p>
            )}
        </s-page>
    );
}
