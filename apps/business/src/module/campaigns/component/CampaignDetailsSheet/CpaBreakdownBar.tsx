import { Card } from "@frak-labs/design-system/components/Card";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { LegendItem } from "@frak-labs/design-system/components/LegendItem";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { vars } from "@frak-labs/design-system/theme";
import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./campaign-details-sheet.css";
import { useDetailFormatters } from "./parts";

type Segment = CampaignDetailsStats["cpaBreakdown"]["segments"][number];

const segmentColor: Record<Segment["key"], string> = {
    frak: vars.icon.action,
    ambassador: vars.icon.success,
    referee: vars.icon.warning,
};

const segmentLabelKey: Record<
    Segment["key"],
    | "campaigns.details.cpa.frak"
    | "campaigns.details.cpa.ambassador"
    | "campaigns.details.cpa.referee"
> = {
    frak: "campaigns.details.cpa.frak",
    ambassador: "campaigns.details.cpa.ambassador",
    referee: "campaigns.details.cpa.referee",
};

export function CpaBreakdownBar({
    cpaBreakdown,
}: {
    cpaBreakdown: CampaignDetailsStats["cpaBreakdown"];
}) {
    const { t } = useTranslation();
    const fmt = useDetailFormatters(cpaBreakdown.currency);

    // With no CPA spend yet there is nothing to allocate, so the bar drops its
    // per-recipient colours and renders a single neutral grey state. The legend
    // keeps its configured percentages.
    const isNeutral = cpaBreakdown.total === 0;

    return (
        <Card radius="m">
            <Stack space="m">
                <Inline space="xs" alignY="baseline">
                    <Text
                        as="span"
                        variant="body"
                        weight="semiBold"
                        className={styles.cpaAmount}
                    >
                        {fmt.currency.format(cpaBreakdown.total)}
                    </Text>
                    <Text as="span" variant="caption" color="disabled">
                        {t("campaigns.details.cpa.costPerAction")}
                    </Text>
                </Inline>

                <div className={styles.cpaBar} aria-hidden="true">
                    {cpaBreakdown.segments.map((segment) => (
                        <div
                            key={segment.key}
                            className={styles.cpaSegment}
                            style={{
                                width: `${segment.pct * 100}%`,
                                backgroundColor: isNeutral
                                    ? vars.surface.disabled
                                    : segmentColor[segment.key],
                            }}
                        />
                    ))}
                </div>

                <Inline space="xl" wrap>
                    {cpaBreakdown.segments.map((segment) => (
                        <LegendItem
                            key={segment.key}
                            swatchColor={segmentColor[segment.key]}
                        >
                            {t("campaigns.details.cpa.legendItem", {
                                label: t(segmentLabelKey[segment.key]),
                                percent: fmt.percent0.format(segment.pct),
                                amount: fmt.currency.format(segment.amount),
                            })}
                        </LegendItem>
                    ))}
                </Inline>
            </Stack>
        </Card>
    );
}
