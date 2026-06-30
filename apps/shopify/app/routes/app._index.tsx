import { LegacyInstall } from "app/components/LegacyInstall";
import { OptionalSetup } from "app/components/OptionalSetup";
import { NewsletterShareLink } from "app/components/Sharing";
import { Stepper } from "app/components/Stepper";
import { ExternalButton } from "app/components/ui/ExternalLink";
import { PageHeading } from "app/components/ui/PageHeading";
import type { loader as appLoader } from "app/routes/app";
import { getLegacyInstallDismissed } from "app/services.server/metafields";
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
    type CampaignListResponse,
    getMerchantBankStatus,
    getMerchantCampaigns,
} from "../services.server/backendMerchant";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }: LoaderFunctionArgs) => {
    const context = await authenticate.admin(request);
    const [campaigns, bankStatus, legacyInstallDismissed] = await Promise.all([
        getMerchantCampaigns(context, request),
        getMerchantBankStatus(context, request),
        getLegacyInstallDismissed(context),
    ]);
    return data({ campaigns, bankStatus, legacyInstallDismissed });
};

export default function Index() {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");
    const isThemeSupportedPromise = rootData?.isThemeSupportedPromise;
    const onboardingDataPromise = rootData?.onboardingDataPromise;
    const businessUrl = rootData?.businessUrl ?? "";
    const walletUrl = rootData?.walletUrl ?? "";
    const componentsUrl = rootData?.componentsUrl ?? "";
    const merchantId = rootData?.merchantId ?? null;
    // Deep-link to this store's merchant dashboard rather than the base (which
    // the business guard would redirect to owned[0] — wrong for multi-store
    // owners).
    const dashboardUrl = merchantId
        ? `${businessUrl}/m/${merchantId}/dashboard`
        : businessUrl;
    const { t } = useTranslation();

    return (
        <s-page heading={t("common.title")}>
            <div
                style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                }}
            >
                <PageHeading>{t("common.title")}</PageHeading>
                <ExternalButton variant="primary" href={dashboardUrl}>
                    {t("common.goToDashboard")}
                </ExternalButton>
            </div>
            <s-stack gap="large">
                <Suspense>
                    <Await resolve={isThemeSupportedPromise}>
                        {(isThemeSupported) => (
                            <Await resolve={onboardingDataPromise}>
                                {(resolved) => (
                                    <Dashboard
                                        onboardingData={resolved ?? {}}
                                        isThemeSupported={
                                            isThemeSupported ?? true
                                        }
                                        merchantId={merchantId}
                                        walletUrl={walletUrl}
                                        componentsUrl={componentsUrl}
                                        businessUrl={businessUrl}
                                    />
                                )}
                            </Await>
                        )}
                    </Await>
                </Suspense>
            </s-stack>
        </s-page>
    );
}

/**
 * Dashboard view for both OS-2.0 and legacy merchants. For legacy themes it
 * prepends the LegacyInstall card; the rest (Stepper while steps are
 * incomplete, data-unavailable banner, or the campaigns/bank dashboard) is
 * shared. `isThemeSupported` drives onboarding criticality + OptionalSetup.
 */
function Dashboard({
    onboardingData,
    isThemeSupported,
    merchantId,
    walletUrl,
    componentsUrl,
    businessUrl,
}: {
    onboardingData: OnboardingStepData;
    isThemeSupported: boolean;
    merchantId: string | null;
    walletUrl: string;
    componentsUrl: string;
    businessUrl: string;
}) {
    const { t } = useTranslation();
    const {
        campaigns: list,
        bankStatus,
        legacyInstallDismissed,
    } = useLoaderData<typeof loader>();
    const { hasMissedCriticalSteps } = validateCompleteOnboarding(
        onboardingData,
        isThemeSupported
    );

    // Once the merchant confirms the manual install, hide the block from the
    // dashboard (the full instructions stay on Settings → Theme).
    const legacyInstall =
        !isThemeSupported && !legacyInstallDismissed ? (
            <LegacyInstall
                merchantId={merchantId}
                walletUrl={walletUrl}
                componentsUrl={componentsUrl}
                businessUrl={businessUrl}
            />
        ) : null;

    const content = hasMissedCriticalSteps ? (
        <Stepper redirectToApp={false} />
    ) : !list || !bankStatus ? (
        <s-section>
            <s-banner tone="warning">
                <s-text>{t("common.dashboardDataUnavailableTitle")}</s-text>
                <s-text>
                    {t("common.dashboardDataUnavailableDescription")}
                </s-text>
            </s-banner>
        </s-section>
    ) : (
        <OnBoardingComplete
            campaigns={list}
            bankStatus={bankStatus}
            onboardingData={onboardingData}
            isThemeSupported={isThemeSupported}
        />
    );

    // While onboarding is incomplete the manual-install snippet can't be used
    // yet (it needs the merchantId from step 1), so lead with the guide and
    // place LegacyInstall after it — this also makes its "complete onboarding
    // first" notice point to the steps directly above. Once complete, the
    // snippet is the key remaining action, so it leads.
    return (
        <s-stack gap="large">
            {hasMissedCriticalSteps ? (
                <>
                    {content}
                    {legacyInstall}
                </>
            ) : (
                <>
                    {legacyInstall}
                    {content}
                </>
            )}
        </s-stack>
    );
}

function OnBoardingComplete({
    campaigns,
    bankStatus,
    onboardingData,
    isThemeSupported = true,
}: {
    campaigns: CampaignListResponse;
    bankStatus: BankStatus;
    onboardingData: OnboardingStepData;
    isThemeSupported?: boolean;
}) {
    return (
        <s-stack gap="large">
            <NewsletterShareLink />
            <CampaignStatus campaigns={campaigns} bankStatus={bankStatus} />
            <BankingStatus bankStatus={bankStatus} />
            {/* OptionalSetup prompts for OS-2.0 share-button/banner app blocks,
                which legacy themes can't host — omit it for them. */}
            {isThemeSupported && (
                <OptionalSetup onboardingData={onboardingData} />
            )}
        </s-stack>
    );
}
