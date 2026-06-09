import type {
    OverviewFunnelKind,
    OverviewFunnels,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    FunnelChart,
    type FunnelStep,
} from "@frak-labs/design-system/components/FunnelChart";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { useTranslation } from "react-i18next";
import { ChartEmptyState } from "./ChartEmptyState";

type Variant = "website" | "wallet";

// Maps backend funnel-stage kinds to i18n keys.
const stepLabelKey: Record<
    OverviewFunnelKind,
    | "campaigns.overview.funnel.steps.shareCtaSeen"
    | "campaigns.overview.funnel.steps.shareInitiated"
    | "campaigns.overview.funnel.steps.linkShared"
    | "campaigns.overview.funnel.steps.referred"
    | "campaigns.overview.funnel.steps.converted"
    | "campaigns.overview.funnel.steps.explorerImpressions"
    | "campaigns.overview.funnel.steps.brandPageOpened"
> = {
    share_cta_seen: "campaigns.overview.funnel.steps.shareCtaSeen",
    share_initiated: "campaigns.overview.funnel.steps.shareInitiated",
    link_shared: "campaigns.overview.funnel.steps.linkShared",
    explorer_impressions: "campaigns.overview.funnel.steps.explorerImpressions",
    brand_page_opened: "campaigns.overview.funnel.steps.brandPageOpened",
    referred: "campaigns.overview.funnel.steps.referred",
    converted: "campaigns.overview.funnel.steps.converted",
};

/** Overview-page funnel card: Website/Wallet tabs + funnel chart in a DS `Card`. */
export function FunnelCard({ funnels }: { funnels: OverviewFunnels }) {
    const { t } = useTranslation();
    const labels: Record<Variant, string> = {
        website: t("campaigns.overview.funnel.website"),
        wallet: t("campaigns.overview.funnel.walletFrak"),
    };

    const toChartSteps = (steps: OverviewFunnels[Variant]): FunnelStep[] =>
        steps.map((step) => ({
            label: t(stepLabelKey[step.kind]),
            value: step.value,
            delta: percentDelta(step.value, step.previousValue),
        }));

    return (
        <Card radius="m">
            <Tabs defaultValue="website">
                <Stack space="m">
                    <TabsList fullWidth>
                        <TabsTrigger fullWidth value="website">
                            {labels.website}
                        </TabsTrigger>
                        <TabsTrigger fullWidth value="wallet">
                            {labels.wallet}
                        </TabsTrigger>
                    </TabsList>
                    {(Object.keys(labels) as Variant[]).map((variant) => {
                        const steps = funnels[variant];
                        const isEmpty =
                            steps.length === 0 ||
                            steps.every((step) => step.value === 0);
                        return (
                            <TabsContent key={variant} value={variant}>
                                <Stack space="m">
                                    <Text variant="bodySmall" color="secondary">
                                        {t("campaigns.overview.funnel.global", {
                                            variant: labels[variant],
                                        })}
                                    </Text>
                                    {isEmpty ? (
                                        <ChartEmptyState />
                                    ) : (
                                        <FunnelChart
                                            steps={toChartSteps(steps)}
                                        />
                                    )}
                                </Stack>
                            </TabsContent>
                        );
                    })}
                </Stack>
            </Tabs>
        </Card>
    );
}

function percentDelta(current: number, previous: number): number | undefined {
    if (previous === 0) return current === 0 ? 0 : undefined;
    return Math.round(((current - previous) / previous) * 100);
}
