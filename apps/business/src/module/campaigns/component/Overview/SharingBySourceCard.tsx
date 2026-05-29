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
import type { CampaignsOverview } from "@/module/campaigns/queries/queryOptions";
import * as local from "./sharingBySource.css";

type Mode = "platform" | "device";

const palette = {
    platform: [vars.icon.action, vars.icon.success],
    device: [vars.icon.action, vars.icon.success, vars.icon.warning],
};

// Maps the known data-provided source labels to i18n keys; unknown labels
// fall through untranslated.
const sourceLabelKey: Record<
    string,
    | "campaigns.overview.sharing.sources.merchantSite"
    | "campaigns.overview.sharing.sources.walletApp"
    | "campaigns.overview.sharing.sources.ios"
    | "campaigns.overview.sharing.sources.android"
    | "campaigns.overview.sharing.sources.desktop"
> = {
    "Merchant Site": "campaigns.overview.sharing.sources.merchantSite",
    "Wallet App": "campaigns.overview.sharing.sources.walletApp",
    iOS: "campaigns.overview.sharing.sources.ios",
    Android: "campaigns.overview.sharing.sources.android",
    Desktop: "campaigns.overview.sharing.sources.desktop",
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
    const { t } = useTranslation();
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

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
                                                    aria-hidden="true"
                                                />
                                                <Text
                                                    as="span"
                                                    variant="caption"
                                                >
                                                    {sourceLabelKey[s.label]
                                                        ? t(
                                                              sourceLabelKey[
                                                                  s.label
                                                              ]
                                                          )
                                                        : s.label}
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
