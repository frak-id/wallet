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

type Variant = "website" | "wallet";

/** Website/Wallet funnel datasets for the overview funnel card. */
type FunnelsData = Record<Variant, FunnelStep[]>;

// Maps the known data-provided funnel-stage labels to i18n keys; unknown
// labels fall through untranslated.
const stepLabelKey: Record<
    string,
    | "campaigns.overview.funnel.steps.shareCtaSeen"
    | "campaigns.overview.funnel.steps.shareInitiated"
    | "campaigns.overview.funnel.steps.linkShared"
    | "campaigns.overview.funnel.steps.referred"
    | "campaigns.overview.funnel.steps.converted"
    | "campaigns.overview.funnel.steps.explorerImpressions"
    | "campaigns.overview.funnel.steps.brandPageOpened"
> = {
    "Share CTA seen": "campaigns.overview.funnel.steps.shareCtaSeen",
    "Share initiated": "campaigns.overview.funnel.steps.shareInitiated",
    "Link shared": "campaigns.overview.funnel.steps.linkShared",
    Referred: "campaigns.overview.funnel.steps.referred",
    Converted: "campaigns.overview.funnel.steps.converted",
    "Explorer impressions":
        "campaigns.overview.funnel.steps.explorerImpressions",
    "Brand page opened": "campaigns.overview.funnel.steps.brandPageOpened",
};

/** Overview-page funnel card: Website/Wallet tabs + funnel chart in a DS `Card`. */
export function FunnelCard({ funnels }: { funnels: FunnelsData }) {
    const { t } = useTranslation();
    const labels: Record<Variant, string> = {
        website: t("campaigns.overview.funnel.website"),
        wallet: t("campaigns.overview.funnel.walletFrak"),
    };

    const localizeSteps = (steps: FunnelStep[]) =>
        steps.map((step) => {
            const key = stepLabelKey[step.label];
            return key ? { ...step, label: t(key) } : step;
        });

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
                    {(Object.keys(labels) as Variant[]).map((variant) => (
                        <TabsContent key={variant} value={variant}>
                            <Stack space="m">
                                <Text variant="bodySmall" color="secondary">
                                    {t("campaigns.overview.funnel.global", {
                                        variant: labels[variant],
                                    })}
                                </Text>
                                <FunnelChart
                                    steps={localizeSteps(funnels[variant])}
                                />
                            </Stack>
                        </TabsContent>
                    ))}
                </Stack>
            </Tabs>
        </Card>
    );
}
