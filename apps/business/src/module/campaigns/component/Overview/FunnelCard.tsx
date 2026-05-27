import { FunnelChart } from "@frak-labs/design-system/components/FunnelChart";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";

type Variant = "website" | "wallet";

const labels: Record<Variant, string> = {
    website: "Website",
    wallet: "Wallet Frak",
};

export function FunnelCard({
    funnels,
}: {
    funnels: CampaignsOverview["funnels"];
}) {
    return (
        <div className={styles.card}>
            <Tabs defaultValue="website">
                <div className={styles.cardTitleRow}>
                    <TabsList>
                        <TabsTrigger value="website">
                            {labels.website}
                        </TabsTrigger>
                        <TabsTrigger value="wallet">
                            {labels.wallet}
                        </TabsTrigger>
                    </TabsList>
                </div>
                {(Object.keys(labels) as Variant[]).map((variant) => (
                    <TabsContent key={variant} value={variant}>
                        <Text variant="bodySmall" color="secondary">
                            Global funnel · {labels[variant]}
                        </Text>
                        <div style={{ marginTop: 16 }}>
                            <FunnelChart steps={funnels[variant]} />
                        </div>
                    </TabsContent>
                ))}
            </Tabs>
        </div>
    );
}
