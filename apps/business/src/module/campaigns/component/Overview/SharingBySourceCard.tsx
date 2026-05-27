import { DonutChart } from "@frak-labs/design-system/components/DonutChart";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./overview.css";
import * as local from "./sharingBySource.css";

type Mode = "platform" | "device";

const palette = {
    platform: [vars.icon.action, vars.icon.success],
    device: [vars.icon.action, vars.icon.success, vars.icon.warning],
};

function withColors(segments: { label: string; value: number }[], mode: Mode) {
    return segments.map((s, i) => ({
        ...s,
        color: palette[mode][i % palette[mode].length],
    }));
}

export function SharingBySourceCard({
    sharing,
}: {
    sharing: CampaignsOverview["sharing"];
}) {
    return (
        <div className={styles.card}>
            <Tabs defaultValue="platform">
                <Stack space="m">
                    <TabsList>
                        <TabsTrigger value="platform">Platform</TabsTrigger>
                        <TabsTrigger value="device">Device</TabsTrigger>
                    </TabsList>
                    <Text variant="bodySmall" color="secondary">
                        Sharing by source
                    </Text>
                    {(["platform", "device"] as Mode[]).map((mode) => {
                        const segments = withColors(sharing[mode], mode);
                        return (
                            <TabsContent key={mode} value={mode}>
                                <Stack space="m">
                                    <DonutChart segments={segments} />
                                    <Inline space="l" align="center" wrap>
                                        {segments.map((s) => (
                                            <Stack key={s.label} space="xxs">
                                                <span
                                                    className={local.dot}
                                                    style={{
                                                        backgroundColor:
                                                            s.color,
                                                    }}
                                                />
                                                <Text
                                                    as="span"
                                                    variant="caption"
                                                >
                                                    {s.label}
                                                </Text>
                                            </Stack>
                                        ))}
                                    </Inline>
                                </Stack>
                            </TabsContent>
                        );
                    })}
                </Stack>
            </Tabs>
        </div>
    );
}
