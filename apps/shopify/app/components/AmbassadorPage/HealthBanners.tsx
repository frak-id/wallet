import type { loader as appLoader } from "app/routes/app";
import type {
    AmbassadorPageStatus,
    AmbassadorProbe,
} from "app/utils/ambassadorPage";
import { Suspense } from "react";
import { useTranslation } from "react-i18next";
import { Await, useNavigate, useRouteLoaderData } from "react-router";
import { useThemeEditorUrl } from "../../hooks/useThemeEditorUrl";
import { ExternalButton } from "../ui/ExternalLink";

type HealthBannersProps = {
    status: AmbassadorPageStatus;
    path: string;
    hasActiveCampaign: boolean | null;
    probePromise: Promise<AmbassadorProbe> | null;
};

/** The storefront problems that keep the page from working, each with at most one action. */
export function HealthBanners({
    status,
    path,
    hasActiveCampaign,
    probePromise,
}: HealthBannersProps) {
    return (
        <>
            <EmbedOffBanner />
            {status === "live" && probePromise && (
                <Suspense fallback={null}>
                    <Await resolve={probePromise} errorElement={null}>
                        {(probe) => <ProbeBanner probe={probe} path={path} />}
                    </Await>
                </Suspense>
            )}
            {hasActiveCampaign === false && (
                <NoCampaignBanner
                    tone={status === "live" ? "warning" : "info"}
                />
            )}
        </>
    );
}

function EmbedOffBanner() {
    const rootData = useRouteLoaderData<typeof appLoader>("routes/app");

    return (
        <Suspense fallback={null}>
            <Await
                resolve={rootData?.supportsAppEmbedPromise}
                errorElement={null}
            >
                {(supportsAppEmbed) =>
                    // Without app embeds Frak comes from a manual snippet, which the theme check cannot see.
                    supportsAppEmbed === false ? null : (
                        <Await
                            resolve={rootData?.onboardingDataPromise}
                            errorElement={null}
                        >
                            {(onboardingData) =>
                                onboardingData?.isThemeHasFrakActivated ===
                                false ? (
                                    <EmbedOffBannerContent
                                        apiKey={rootData?.apiKey ?? ""}
                                    />
                                ) : null
                            }
                        </Await>
                    )
                }
            </Await>
        </Suspense>
    );
}

function EmbedOffBannerContent({ apiKey }: { apiKey: string }) {
    const { t } = useTranslation();
    const editorUrl = useThemeEditorUrl();

    return (
        <s-banner
            tone="critical"
            heading={t("ambassadorPage.health.embedOff.heading")}
        >
            <s-paragraph>
                {t("ambassadorPage.health.embedOff.body")}
            </s-paragraph>
            <ExternalButton
                slot="secondary-actions"
                icon="external"
                href={`${editorUrl}?context=apps&activateAppId=${apiKey}/listener`}
            >
                {t("ambassadorPage.health.embedOff.action")}
            </ExternalButton>
        </s-banner>
    );
}

function ProbeBanner({
    probe,
    path,
}: {
    probe: AmbassadorProbe;
    path: string;
}) {
    const { t } = useTranslation();

    switch (probe) {
        case "missing":
            return (
                <s-banner
                    tone="warning"
                    heading={t("ambassadorPage.health.missing.heading")}
                >
                    <s-paragraph>
                        {t("ambassadorPage.health.missing.body", { path })}
                    </s-paragraph>
                </s-banner>
            );
        case "locked":
            return (
                <s-banner
                    tone="info"
                    heading={t("ambassadorPage.health.locked.heading")}
                >
                    <s-paragraph>
                        {t("ambassadorPage.health.locked.body")}
                    </s-paragraph>
                </s-banner>
            );
        case "live":
        case "unknown":
            return null;
    }
}

function NoCampaignBanner({ tone }: { tone: "warning" | "info" }) {
    const { t } = useTranslation();
    const navigate = useNavigate();

    return (
        <s-banner
            tone={tone}
            heading={t("ambassadorPage.health.noCampaign.heading")}
        >
            <s-paragraph>
                {t("ambassadorPage.health.noCampaign.body")}
            </s-paragraph>
            <s-button
                slot="secondary-actions"
                onClick={() => navigate("/app/campaigns")}
            >
                {t("ambassadorPage.health.noCampaign.action")}
            </s-button>
        </s-banner>
    );
}
