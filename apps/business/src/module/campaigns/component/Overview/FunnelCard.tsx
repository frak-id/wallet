import type {
    OverviewFunnelKind,
    OverviewFunnels,
} from "@frak-labs/backend-elysia/orchestration/schemas";
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
import * as styles from "./overview.css";

type Variant = "website" | "wallet";

const tabLabels: Record<Variant, string> = {
    website: "Website",
    wallet: "Wallet Frak",
};

const FUNNEL_LABELS: Record<OverviewFunnelKind, string> = {
    share_cta_seen: "Share CTA seen",
    share_initiated: "Share initiated",
    link_shared: "Link shared",
    explorer_impressions: "Explorer impressions",
    brand_page_opened: "Brand page opened",
    referred: "Referred",
    converted: "Converted",
};

export function FunnelCard({ funnels }: { funnels: OverviewFunnels }) {
    function toChartSteps(steps: OverviewFunnels[Variant]): FunnelStep[] {
        return steps.map((step) => ({
            label: FUNNEL_LABELS[step.kind],
            value: step.value,
            delta: percentDelta(step.value, step.previousValue),
        }));
    }

    return (
        <div className={styles.card}>
            <Tabs defaultValue="website">
                <Stack space="m">
                    <TabsList>
                        <TabsTrigger value="website">
                            {tabLabels.website}
                        </TabsTrigger>
                        <TabsTrigger value="wallet">
                            {tabLabels.wallet}
                        </TabsTrigger>
                    </TabsList>
                    {(Object.keys(tabLabels) as Variant[]).map((variant) => (
                        <TabsContent key={variant} value={variant}>
                            <Stack space="m">
                                <Text variant="bodySmall" color="secondary">
                                    Global funnel · {tabLabels[variant]}
                                </Text>
                                <FunnelChart
                                    steps={toChartSteps(funnels[variant])}
                                />
                            </Stack>
                        </TabsContent>
                    ))}
                </Stack>
            </Tabs>
        </div>
    );
}

function percentDelta(current: number, previous: number): number | undefined {
    if (previous === 0) return current === 0 ? 0 : undefined;
    return Math.round(((current - previous) / previous) * 100);
}
