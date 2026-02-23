import { CampaignStatus } from "app/components/Campaign";
import { PageHeading } from "app/components/ui/PageHeading";
import { authenticate } from "app/shopify.server";
import { buildCampaignRule } from "app/utils/campaignCreation";
import { useTranslation } from "react-i18next";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "react-router";
import { data, useLoaderData } from "react-router";
import {
    archiveMerchantCampaign,
    createMerchantCampaign,
    deleteMerchantCampaign,
    getMerchantBankStatus,
    getMerchantCampaigns,
    pauseMerchantCampaign,
    publishMerchantCampaign,
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

async function handleCreateCampaign(
    context: AuthenticatedContext,
    request: Request,
    formData: FormData
): Promise<CampaignActionResult> {
    const name = formData.get("name") as string;
    const globalBudget = Number(formData.get("globalBudget"));
    const rawCAC = Number(formData.get("rawCAC"));
    const ratio = Number(formData.get("ratio"));

    if (!name || !globalBudget || !rawCAC || !ratio) {
        return {
            success: false,
            error: "Missing required campaign fields",
        };
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
        return {
            success: false,
            error: "Failed to create campaign",
        };
    }

    const published = await publishMerchantCampaign(
        context,
        request,
        campaign.id
    );
    if (!published) {
        return {
            success: false,
            error: "Campaign created but failed to publish",
        };
    }

    return { success: true, error: null };
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

    if (intent === "create-campaign") {
        return data(await handleCreateCampaign(context, request, formData));
    }

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
