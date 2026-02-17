import { Stepper } from "app/components/Stepper";
import { PageHeading } from "app/components/ui/PageHeading";
import type { loader as appLoader } from "app/routes/app";
import {
    type OnboardingStepData,
    validateCompleteOnboarding,
} from "app/utils/onboarding";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import type { LoaderFunctionArgs } from "react-router";
import { Await, data, useLoaderData, useRouteLoaderData } from "react-router";
import { CampaignStatus } from "../components/Campaign";
import { BankingStatus } from "../components/Funding/Bank";
import {
    type BankStatus,
    type CampaignResponse,
    getMerchantBankStatus,
    getMerchantCampaigns,
} from "../services.server/backendMerchant";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [campaigns, bankStatus] = await Promise.all([
        getMerchantCampaigns(context, request),
        getMerchantBankStatus(context, request),
    ]);
    return data({ campaigns, bankStatus });
};

export default function Index() {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const isThemeSupportedPromise = rootData?.isThemeSupportedPromise;
    const onboardingDataPromise = rootData?.onboardingDataPromise;
    const { t } = useTranslation();

    return (
        <s-page heading={t("common.title")}>
            <PageHeading>{t("common.title")}</PageHeading>
            <s-button
                slot="primary-action"
                variant="primary"
                href={process.env.BUSINESS_URL}
                target="_blank"
            >
                {t("common.goToDashboard")}
            </s-button>
            <s-stack gap="large">
                <Suspense>
                    <Await resolve={isThemeSupportedPromise}>
                        {(isThemeSupported) => {
                            return (
                                <>
                                    {!isThemeSupported && <ThemeNotSupported />}
                                    {isThemeSupported && (
                                        <Await resolve={onboardingDataPromise}>
                                            {(resolved) => (
                                                <ThemeSupported
                                                    onboardingData={
                                                        resolved ?? {}
                                                    }
                                                />
                                            )}
                                        </Await>
                                    )}
                                </>
                            );
                        }}
                    </Await>
                </Suspense>
            </s-stack>
        </s-page>
    );
}

function ThemeNotSupported() {
    return (
        <>
            <s-text>
                It looks like your theme does not fully support the
                functionality of this app.
            </s-text>
            <s-text>
                Try switching to a different theme or contacting your theme
                developer to request support.
            </s-text>
        </>
    );
}

function ThemeSupported({
    onboardingData,
}: {
    onboardingData: OnboardingStepData;
}) {
    const { t } = useTranslation();
    const { campaigns, bankStatus } = useLoaderData<typeof loader>();
    const validationResult = validateCompleteOnboarding(onboardingData);

    if (!validationResult.isComplete) {
        return <Stepper redirectToApp={false} />;
    }

    if (!campaigns || !bankStatus) {
        return (
            <s-section>
                <s-banner tone="warning">
                    <s-text>{t("common.dashboardDataUnavailableTitle")}</s-text>
                    <s-text>
                        {t("common.dashboardDataUnavailableDescription")}
                    </s-text>
                </s-banner>
            </s-section>
        );
    }

    return (
        <s-stack gap="large">
            <OnBoardingComplete campaigns={campaigns} bankStatus={bankStatus} />
        </s-stack>
    );
}

function OnBoardingComplete({
    campaigns,
    bankStatus,
}: {
    campaigns: CampaignResponse[];
    bankStatus: BankStatus;
}) {
    return (
        <s-stack gap="large">
            <CampaignStatus campaigns={campaigns} bankStatus={bankStatus} />
            <BankingStatus bankStatus={bankStatus} />
        </s-stack>
    );
}
