import type { OverviewSharing } from "@frak-labs/backend-elysia/orchestration/schemas";
import {
    PieChart,
    PieSlice,
    PieSliceLabels,
} from "@frak-labs/design-system/components/charts";
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
import clsx from "clsx";
import { useState } from "react";
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

export function SharingBySourceCard({ sharing }: { sharing: OverviewSharing }) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
                                    <Inline align="center" space="none">
                                        <PieChart
                                            cornerRadius={2}
                                            data={segments}
                                            hoverOffset={8}
                                            hoveredIndex={hoveredIndex}
                                            innerRadius={52}
                                            onHoverChange={setHoveredIndex}
                                            padAngle={0.02}
                                            size={180}
                                        >
                                            {segments.map((s, i) => (
                                                <PieSlice
                                                    index={i}
                                                    key={s.label}
                                                />
                                            ))}
                                            <PieSliceLabels />
                                        </PieChart>
                                    </Inline>
                                    <Inline space="l" align="center" wrap>
                                        {segments.map((s, i) => (
                                            <div
                                                className={clsx(
                                                    local.legendItem,
                                                    hoveredIndex === i &&
                                                        local.legendItemActive,
                                                    hoveredIndex !== null &&
                                                        hoveredIndex !== i &&
                                                        local.legendItemDimmed
                                                )}
                                                key={s.label}
                                                onMouseEnter={() =>
                                                    setHoveredIndex(i)
                                                }
                                                onMouseLeave={() =>
                                                    setHoveredIndex(null)
                                                }
                                            >
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
                                            </div>
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
