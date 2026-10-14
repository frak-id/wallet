import { Card } from "@frak-labs/design-system/components/Card";
import {
    Area,
    AreaChart,
    Bar,
    BarChart,
    BarXAxis,
    ChartTooltip,
    Grid,
    NumericYAxis,
    PieChart,
    PieSlice,
    PieSliceLabels,
    ReferenceLine,
    XAxis,
} from "@frak-labs/design-system/components/charts";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { LegendItem } from "@frak-labs/design-system/components/LegendItem";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { vars } from "@frak-labs/design-system/theme";
import { useState } from "react";
import { chartFixtures } from "../fixtures";
import { chartBox, chartBoxTall } from "../gallery.css";
import { Case, Cases } from "../ui";

const LOCALE = "en-US";
const colors = [vars.icon.action, vars.icon.success, vars.icon.warning];

const platform = [
    { label: "Merchant site", value: 62 },
    { label: "Wallet app", value: 38 },
];
const device = [
    { label: "Mobile", value: 54 },
    { label: "Desktop", value: 31 },
    { label: "Tablet", value: 15 },
];

function SharingPie({
    buckets,
}: {
    buckets: { label: string; value: number }[];
}) {
    const segments = buckets.map((bucket, i) => ({
        ...bucket,
        color: colors[i % colors.length],
    }));
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
    return (
        <Card radius="m">
            <Stack space="m">
                <Inline align="center" space="none">
                    <PieChart
                        cornerRadius={2}
                        data={segments}
                        hoverOffset={8}
                        hoveredIndex={hoveredIndex}
                        innerRadius={59}
                        onHoverChange={setHoveredIndex}
                        padAngle={0.02}
                        size={186}
                    >
                        {segments.map((s, i) => (
                            <PieSlice index={i} key={s.label} />
                        ))}
                        <PieSliceLabels />
                    </PieChart>
                </Inline>
                <Inline space="xl" wrap>
                    {segments.map((s) => (
                        <LegendItem
                            layout="stacked"
                            swatchColor={s.color}
                            key={s.label}
                        >
                            {s.label}
                        </LegendItem>
                    ))}
                </Inline>
            </Stack>
        </Card>
    );
}

export function SharingPieSection() {
    return (
        <Cases title="Pie">
            <Case name="platform" fill>
                <SharingPie buckets={platform} />
            </Case>
            <Case name="device" fill>
                <SharingPie buckets={device} />
            </Case>
        </Cases>
    );
}

const areaMargin = { top: 8, right: 44, bottom: 24, left: 8 };

type AreaPoint = { date: Date; actual?: number; forecast?: number };

function ProjectedRevenue({ data }: { data: readonly AreaPoint[] }) {
    return (
        <Card radius="m">
            <Stack space="m">
                <AreaChart
                    className={chartBox}
                    data={[...data]}
                    locale={LOCALE}
                    margin={areaMargin}
                    xDataKey="date"
                >
                    <Grid vertical={false} />
                    <Area
                        dataKey="actual"
                        fill={vars.icon.success}
                        stroke={vars.icon.success}
                    />
                    <Area
                        dataKey="forecast"
                        fill={vars.border.default}
                        stroke={vars.border.default}
                    />
                    <XAxis tickMode="data" />
                    <NumericYAxis
                        formatter={(v) => `${v / 1000}k€`}
                        ticks={[0, 5000, 10000, 15000]}
                    />
                    <ChartTooltip
                        rows={(point) =>
                            [
                                point.actual != null
                                    ? {
                                          color: vars.icon.success,
                                          label: "Actual revenue",
                                          value: point.actual as number,
                                      }
                                    : null,
                                point.forecast != null
                                    ? {
                                          color: vars.icon.tertiary,
                                          label: "Forecast revenue",
                                          value: point.forecast as number,
                                      }
                                    : null,
                            ].filter((row) => row !== null)
                        }
                    />
                </AreaChart>
                <Inline space="xl">
                    <LegendItem
                        layout="stacked"
                        swatchColor={vars.icon.success}
                    >
                        Actual revenue
                    </LegendItem>
                    <LegendItem
                        layout="stacked"
                        swatchColor={vars.icon.tertiary}
                    >
                        Forecast revenue
                    </LegendItem>
                </Inline>
            </Stack>
        </Card>
    );
}

export function ProjectedAreaSection() {
    return (
        <Cases title="Area">
            <Case name="actual and forecast" fill>
                <ProjectedRevenue data={chartFixtures.revenue} />
            </Case>
        </Cases>
    );
}

const purchasesMargin = { top: 8, right: 44, bottom: 40, left: 8 };

type BarPoint = { label: string; value: number };

function Purchases({
    data,
    average,
}: {
    data: readonly BarPoint[];
    average: number;
}) {
    return (
        <Card radius="m">
            <Stack space="m">
                <BarChart
                    barWidth={16}
                    className={chartBox}
                    data={[...data]}
                    locale={LOCALE}
                    margin={purchasesMargin}
                    xDataKey="label"
                >
                    <Bar
                        dataKey="value"
                        fill={vars.icon.action}
                        lineCap="butt"
                    />
                    <ReferenceLine label={`${average}\navg/mo`} y={average} />
                    <BarXAxis fadeNearCursor={false} />
                    <NumericYAxis
                        formatter={(v) => (v === 0 ? "0" : `${v / 1000}k`)}
                        ticks={[0, 5000]}
                    />
                    <ChartTooltip
                        rows={(point) => [
                            {
                                color: vars.icon.action,
                                label: "Purchases",
                                value: (point.value as number) ?? 0,
                            },
                        ]}
                        showDatePill={false}
                    />
                </BarChart>
                <LegendItem layout="stacked" swatchColor={vars.icon.action}>
                    Purchases
                </LegendItem>
            </Stack>
        </Card>
    );
}

export function PurchasesBarSection() {
    return (
        <Cases title="Bar">
            <Case name="with reference line" fill>
                <Purchases data={chartFixtures.purchases} average={3500} />
            </Case>
        </Cases>
    );
}

const dailyMargin = { top: 8, right: 16, bottom: 40, left: 8 };

function DailySeries({
    data,
    color,
}: {
    data: readonly BarPoint[];
    color: string;
}) {
    return (
        <Card radius="m">
            <BarChart
                barWidth={16}
                className={chartBoxTall}
                data={[...data]}
                locale={LOCALE}
                margin={dailyMargin}
                xDataKey="label"
            >
                <Bar dataKey="value" fill={color} lineCap="butt" />
                <BarXAxis fadeNearCursor={false} />
                <NumericYAxis />
                <ChartTooltip
                    rows={(point) => [
                        {
                            color,
                            label: "Clicks",
                            value: (point.value as number) ?? 0,
                        },
                    ]}
                    showDatePill={false}
                />
            </BarChart>
        </Card>
    );
}

export function AffiliateBarSection() {
    return (
        <Cases title="Bar">
            <Case name="clicks" fill>
                <DailySeries
                    data={chartFixtures.daily}
                    color={vars.icon.action}
                />
            </Case>
            <Case name="actions" fill>
                <DailySeries
                    data={chartFixtures.daily}
                    color={vars.icon.success}
                />
            </Case>
        </Cases>
    );
}

const single: readonly BarPoint[] = [{ label: "Sep 01", value: 42 }];
const zeros: readonly BarPoint[] = [
    { label: "Sep 01", value: 0 },
    { label: "Sep 02", value: 0 },
    { label: "Sep 03", value: 0 },
];
const huge: readonly BarPoint[] = [
    { label: "Sep 01", value: 9_000_000_000_000 },
    { label: "Sep 02", value: 12 },
    { label: "Sep 03", value: 4_500_000_000_000 },
];

export function ChartWorstCaseSection() {
    return (
        <>
            <Cases title="Worst Case: Bar">
                <Case name="bar single data point" fill>
                    <DailySeries data={single} color={vars.icon.action} />
                </Case>
                <Case name="bar all zeros" fill>
                    <DailySeries data={zeros} color={vars.icon.action} />
                </Case>
                <Case name="bar very large value" fill>
                    <DailySeries data={huge} color={vars.icon.action} />
                </Case>
            </Cases>
            <Cases title="Worst Case: Area">
                <Case name="area single data point" fill>
                    <ProjectedRevenue
                        data={[
                            {
                                date: new Date("2026-01-01T00:00:00Z"),
                                actual: 1200,
                            },
                        ]}
                    />
                </Case>
                <Case name="area all zeros" fill>
                    <ProjectedRevenue
                        data={chartFixtures.revenue.map((p) => ({
                            date: p.date,
                            actual: 0,
                        }))}
                    />
                </Case>
                <Case name="area very large value" fill>
                    <ProjectedRevenue
                        data={[
                            {
                                date: new Date("2026-01-01T00:00:00Z"),
                                actual: 9_000_000_000_000,
                            },
                            {
                                date: new Date("2026-02-01T00:00:00Z"),
                                actual: 4_500_000_000_000,
                            },
                        ]}
                    />
                </Case>
            </Cases>
            <Cases title="Worst Case: Pie">
                <Case name="pie single slice" fill>
                    <SharingPie
                        buckets={[{ label: "Wallet app", value: 100 }]}
                    />
                </Case>
                <Case name="pie very large value" fill>
                    <SharingPie
                        buckets={[
                            {
                                label: "Merchant site",
                                value: 9_000_000_000_000,
                            },
                            { label: "Wallet app", value: 1 },
                        ]}
                    />
                </Case>
            </Cases>
        </>
    );
}
