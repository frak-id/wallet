import {
    type AmbassadorPageActions,
    useAmbassadorPage,
} from "app/hooks/useAmbassadorPage";
import { useRefreshData } from "app/hooks/useRefreshData";
import { useVisibilityChange } from "app/hooks/useVisibilityChange";
import type {
    AmbassadorPageActionResult,
    AmbassadorPageOverview,
    AmbassadorPageWarning,
    AmbassadorProbe,
} from "app/utils/ambassadorPage";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useRevalidator } from "react-router";
import { HealthBanners } from "./HealthBanners";
import { LiveSections } from "./LiveSections";
import { PublishSection } from "./PublishSection";
import { SwitchSection } from "./SwitchSection";

const WARNING_KEY: Record<AmbassadorPageWarning, string> = {
    menuRemoveFailed: "ambassadorPage.warnings.menuRemoveFailed",
    repointFailed: "ambassadorPage.warnings.repointFailed",
    oldPageHideFailed: "ambassadorPage.warnings.oldPageHideFailed",
    redirectFailed: "ambassadorPage.warnings.redirectFailed",
    recordFailed: "ambassadorPage.warnings.recordFailed",
};

type AmbassadorPageScreenProps = {
    overview: AmbassadorPageOverview | null;
    hasActiveCampaign: boolean | null;
    customizeUrl: string | null;
    probePromise: Promise<AmbassadorProbe> | null;
};

/** The ambassador page screen, one state per page status. */
export function AmbassadorPageScreen({
    overview,
    hasActiveCampaign,
    customizeUrl,
    probePromise,
}: AmbassadorPageScreenProps) {
    const refresh = useRefreshData();
    const actions = useAmbassadorPage();

    useVisibilityChange(refresh);

    if (!overview) return <LoadError />;

    return (
        <s-stack gap="large">
            <HealthBanners
                status={overview.status}
                path={overview.path}
                hasActiveCampaign={hasActiveCampaign}
                probePromise={probePromise}
            />
            <ActionWarnings result={actions.result} />
            <StatusSections
                overview={overview}
                customizeUrl={customizeUrl}
                actions={actions}
            />
        </s-stack>
    );
}

function StatusSections({
    overview,
    customizeUrl,
    actions,
}: {
    overview: AmbassadorPageOverview;
    customizeUrl: string | null;
    actions: AmbassadorPageActions;
}) {
    const address = overview.url.replace(/^https?:\/\//, "");

    switch (overview.status) {
        case "live":
            return (
                <LiveSections
                    overview={overview}
                    address={address}
                    customizeUrl={customizeUrl}
                    actions={actions}
                />
            );
        case "oldPage":
            return <SwitchSection overview={overview} actions={actions} />;
        case "draft":
        case "hidden":
            return (
                <PublishSection
                    overview={overview}
                    address={address}
                    actions={actions}
                />
            );
    }
}

function ActionWarnings({
    result,
}: {
    result: AmbassadorPageActionResult | undefined;
}) {
    const { t } = useTranslation();
    const [dismissed, setDismissed] = useState<AmbassadorPageActionResult>();
    const warnings =
        result?.ok && result !== dismissed ? (result.warnings ?? []) : [];

    if (warnings.length === 0) return null;

    return (
        <s-banner
            tone="warning"
            dismissible
            onDismiss={() => setDismissed(result)}
        >
            {warnings.length === 1 ? (
                <s-paragraph>{t(WARNING_KEY[warnings[0]])}</s-paragraph>
            ) : (
                <s-unordered-list>
                    {warnings.map((warning) => (
                        <s-list-item key={warning}>
                            {t(WARNING_KEY[warning])}
                        </s-list-item>
                    ))}
                </s-unordered-list>
            )}
        </s-banner>
    );
}

function LoadError() {
    const { t } = useTranslation();
    const { revalidate, state } = useRevalidator();

    return (
        <s-banner
            tone="critical"
            heading={t("ambassadorPage.loadError.heading")}
        >
            <s-paragraph>{t("ambassadorPage.loadError.body")}</s-paragraph>
            <s-button
                slot="secondary-actions"
                loading={state === "loading"}
                onClick={() => revalidate()}
            >
                {t("ambassadorPage.loadError.retry")}
            </s-button>
        </s-banner>
    );
}
