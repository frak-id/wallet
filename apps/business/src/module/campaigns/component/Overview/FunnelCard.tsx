import type { OverviewFunnels } from "@frak-labs/backend-elysia/orchestration/schemas";
import { FunnelChart } from "@frak-labs/design-system/components/FunnelChart";
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

const labels: Record<Variant, string> = {
    website: "Website",
    wallet: "Wallet Frak",
};

export function FunnelCard({ funnels }: { funnels: OverviewFunnels }) {
    return (
        <div className={styles.card}>
            <Tabs defaultValue="website">
                <Stack space="m">
                    <TabsList>
                        <TabsTrigger value="website">
                            {labels.website}
                        </TabsTrigger>
                        <TabsTrigger value="wallet">
                            {labels.wallet}
                        </TabsTrigger>
                    </TabsList>
                    {(Object.keys(labels) as Variant[]).map((variant) => (
                        <TabsContent key={variant} value={variant}>
                            <Stack space="m">
                                <Text variant="bodySmall" color="secondary">
                                    Global funnel · {labels[variant]}
                                </Text>
                                <FunnelChart steps={funnels[variant]} />
                            </Stack>
                        </TabsContent>
                    ))}
                </Stack>
            </Tabs>
        </div>
    );
}
