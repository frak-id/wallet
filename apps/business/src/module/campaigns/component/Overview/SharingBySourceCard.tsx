import type {
    OverviewSharing,
    OverviewSharingDeviceKind,
    OverviewSharingPlatformKind,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
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
import { useTranslation } from "react-i18next";
import { ChartEmptyState } from "./ChartEmptyState";
import * as local from "./sharingBySource.css";

type Mode = "platform" | "device";

const palette = {
    platform: [vars.icon.action, vars.icon.success],
    device: [vars.icon.action, vars.icon.success, vars.icon.warning],
};

const platformLabelKey: Record<
    OverviewSharingPlatformKind,
    | "campaigns.overview.sharing.sources.merchantSite"
    | "campaigns.overview.sharing.sources.walletApp"
> = {
    merchant_site: "campaigns.overview.sharing.sources.merchantSite",
    wallet_app: "campaigns.overview.sharing.sources.walletApp",
};

const deviceLabelKey: Record<
    OverviewSharingDeviceKind,
    | "campaigns.overview.sharing.sources.mobile"
    | "campaigns.overview.sharing.sources.desktop"
    | "campaigns.overview.sharing.sources.tablet"
    | "campaigns.overview.sharing.sources.other"
> = {
    mobile: "campaigns.overview.sharing.sources.mobile",
    desktop: "campaigns.overview.sharing.sources.desktop",
    tablet: "campaigns.overview.sharing.sources.tablet",
    other: "campaigns.overview.sharing.sources.other",
};

type LabeledSegment = { label: string; value: number; color: string };

function withColors(
    segments: { label: string; value: number }[],
    mode: Mode
): LabeledSegment[] {
    return segments.map((s, i) => ({
        ...s,
        color: palette[mode][i % palette[mode].length],
    }));
}

export function SharingBySourceCard({ sharing }: { sharing: OverviewSharing }) {
    const { t } = useTranslation();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

    function toLabeledSegments(mode: Mode): LabeledSegment[] {
        if (mode === "platform") {
            const labeled = sharing.platform.map((bucket) => ({
                label: t(platformLabelKey[bucket.kind]),
                value: bucket.value,
            }));
            return withColors(labeled, "platform");
        }
        const labeled = sharing.device.map((bucket) => ({
            label: t(deviceLabelKey[bucket.kind]),
            value: bucket.value,
        }));
        return withColors(labeled, "device");
    }

    return (
        <Card radius="m">
            <Tabs defaultValue="platform">
                <Stack space="m">
                    <TabsList fullWidth>
                        <TabsTrigger fullWidth value="platform">
                            {t("campaigns.overview.sharing.platform")}
                        </TabsTrigger>
                        <TabsTrigger fullWidth value="device">
                            {t("campaigns.overview.sharing.device")}
                        </TabsTrigger>
                    </TabsList>
                    <Text as="h2" variant="bodySmall" color="secondary">
                        {t("campaigns.overview.sharing.title")}
                    </Text>
                    {(["platform", "device"] as Mode[]).map((mode) => {
                        const segments = toLabeledSegments(mode);
                        const isEmpty =
                            segments.length === 0 ||
                            segments.every((s) => s.value === 0);
                        if (isEmpty) {
                            return (
                                <TabsContent key={mode} value={mode}>
                                    <ChartEmptyState />
                                </TabsContent>
                            );
                        }
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
                                                    aria-hidden="true"
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
        </Card>
    );
}
