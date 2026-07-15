import type {
    AffiliateActionsReport,
    AffiliateDailyCount,
} from "@frak-labs/backend-elysia/orchestration/schemas";
import { Card } from "@frak-labs/design-system/components/Card";
import {
    Bar,
    BarChart,
    BarXAxis,
    ChartTooltip,
    NumericYAxis,
} from "@frak-labs/design-system/components/charts";
import { Notice } from "@frak-labs/design-system/components/Notice";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { Tiles } from "@frak-labs/design-system/components/Tiles";
import { vars } from "@frak-labs/design-system/theme";
import { useSuspenseQuery } from "@tanstack/react-query";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { KpiCard } from "@/module/campaigns/component/KpiCard";
import { affiliateReportQueryOptions } from "@/module/campaigns/queries/queryOptions";
import { useIsDemoMode } from "@/module/common/atoms/demoMode";
import { DetailRow, DetailValue } from "@/module/common/component/DetailRow";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { getDateTimeFormat } from "@/module/common/utils/intlCache";
import { AffiliateReportDateChip } from "./AffiliateReportDateChip";
import * as styles from "./affiliateReport.css";

type WindowProps = { from?: string; to?: string };

export function AffiliateReport({ from, to }: WindowProps) {
    const { t, i18n } = useTranslation();
    const merchantId = useActiveMerchantId();
    const isDemoMode = useIsDemoMode();
    const { data } = useSuspenseQuery(
        affiliateReportQueryOptions({ merchantId, isDemoMode, from, to })
    );

    const numberFormatter = useMemo(
        () =>
            new Intl.NumberFormat(i18n.language, { maximumFractionDigits: 0 }),
        [i18n.language]
    );

    const { actions, clicks, brand } = data;
    const truncated = actions.truncated || clicks.truncated;
    // clicks → actions conversion (guard div-by-zero).
    const conversionRate =
        clicks.total > 0 ? (actions.total / clicks.total) * 100 : 0;

    return (
        <div className={styles.page}>
            <Stack space="l">
                <div className={styles.header}>
                    <Stack space="xxs">
                        <Text as="h2" variant="bodySmall" color="secondary">
                            {t("campaigns.affiliateReport.brand.title", {
                                id: brand.externalId,
                            })}
                        </Text>
                        <Text as="span" variant="caption" color="tertiary">
                            {brand.trackingLink}
                        </Text>
                    </Stack>
                    <AffiliateReportDateChip />
                </div>

                {truncated && (
                    <Notice tone="warning" role="status">
                        {t("campaigns.affiliateReport.truncated")}
                    </Notice>
                )}

                <Tiles columns={{ mobile: 1, tablet: 2, desktop: 4 }} space="m">
                    <KpiCard
                        label={t("campaigns.affiliateReport.kpi.clicks")}
                        amount={numberFormatter.format(clicks.total)}
                    />
                    <KpiCard
                        label={t("campaigns.affiliateReport.kpi.actions")}
                        amount={numberFormatter.format(actions.total)}
                    />
                    <KpiCard
                        label={t("campaigns.affiliateReport.kpi.sales")}
                        amount={numberFormatter.format(actions.byType.sale)}
                    />
                    <KpiCard
                        label={t("campaigns.affiliateReport.kpi.conversion")}
                        amount={`${conversionRate.toFixed(1)}%`}
                    />
                </Tiles>

                <div className={styles.twoColumns}>
                    <DailySeriesCard
                        title={t("campaigns.affiliateReport.clicksOverTime")}
                        series={clicks.series}
                        color={vars.icon.action}
                        locale={i18n.language}
                        emptyLabel={t("campaigns.affiliateReport.noData")}
                    />
                    <DailySeriesCard
                        title={t("campaigns.affiliateReport.actionsOverTime")}
                        series={actions.series}
                        color={vars.icon.success}
                        locale={i18n.language}
                        emptyLabel={t("campaigns.affiliateReport.noData")}
                    />
                </div>

                <div className={styles.twoColumns}>
                    <ActionBreakdownCard
                        actions={actions}
                        numberFormatter={numberFormatter}
                    />
                    <RevenueCard
                        revenue={actions.revenue}
                        locale={i18n.language}
                    />
                </div>
            </Stack>
        </div>
    );
}

const chartMargin = { top: 8, right: 16, bottom: 40, left: 8 };

function DailySeriesCard({
    title,
    series,
    color,
    locale,
    emptyLabel,
}: {
    title: string;
    series: AffiliateDailyCount[];
    color: string;
    locale: string;
    emptyLabel: string;
}) {
    const data = useMemo(() => {
        const labelFormatter = getDateTimeFormat(locale, {
            month: "short",
            day: "2-digit",
            timeZone: "UTC",
        });
        return series.map((point) => {
            const parsed = new Date(`${point.date}T00:00:00Z`);
            return {
                label: Number.isNaN(parsed.getTime())
                    ? point.date
                    : labelFormatter.format(parsed),
                value: point.count,
            };
        });
    }, [series, locale]);

    const isEmpty = data.length === 0;

    return (
        <Card radius="m">
            <Stack space="m">
                <Text as="h2" variant="bodySmall" color="secondary">
                    {title}
                </Text>
                {isEmpty ? (
                    <Text as="span" variant="caption" color="tertiary">
                        {emptyLabel}
                    </Text>
                ) : (
                    <BarChart
                        barWidth={16}
                        className={styles.chartBox}
                        data={data}
                        locale={locale}
                        margin={chartMargin}
                        xDataKey="label"
                    >
                        <Bar dataKey="value" fill={color} lineCap="butt" />
                        <BarXAxis fadeNearCursor={false} />
                        <NumericYAxis />
                        <ChartTooltip
                            rows={(point) => [
                                {
                                    color,
                                    label: title,
                                    value: (point.value as number) ?? 0,
                                },
                            ]}
                            showDatePill={false}
                        />
                    </BarChart>
                )}
            </Stack>
        </Card>
    );
}

function ActionBreakdownCard({
    actions,
    numberFormatter,
}: {
    actions: AffiliateActionsReport;
    numberFormatter: Intl.NumberFormat;
}) {
    const { t } = useTranslation();
    const rows: { label: string; value: number }[] = [
        {
            label: t("campaigns.affiliateReport.status.pending"),
            value: actions.byStatus.pending,
        },
        {
            label: t("campaigns.affiliateReport.status.confirmed"),
            value: actions.byStatus.confirmed,
        },
        {
            label: t("campaigns.affiliateReport.status.settled"),
            value: actions.byStatus.settled,
        },
        {
            label: t("campaigns.affiliateReport.status.canceled"),
            value: actions.byStatus.canceled,
        },
    ];

    return (
        <Card radius="m">
            <Stack space="s">
                <Text as="h2" variant="bodySmall" color="secondary">
                    {t("campaigns.affiliateReport.statusBreakdown")}
                </Text>
                <Stack space="none">
                    {rows.map((row) => (
                        <DetailRow key={row.label} label={row.label}>
                            <DetailValue>
                                {numberFormatter.format(row.value)}
                            </DetailValue>
                        </DetailRow>
                    ))}
                </Stack>
            </Stack>
        </Card>
    );
}

type RevenueRow = AffiliateActionsReport["revenue"][number];

const revenueColumnHelper = createColumnHelper<RevenueRow>();

function RevenueCard({
    revenue,
    locale,
}: {
    revenue: AffiliateActionsReport["revenue"];
    locale: string;
}) {
    const { t } = useTranslation();

    const columns = useMemo(
        () =>
            [
                revenueColumnHelper.accessor("currencyCode", {
                    header: t("campaigns.affiliateReport.revenue.currency"),
                    cell: ({ getValue }) => getValue(),
                }),
                revenueColumnHelper.accessor("orderAmount", {
                    header: t("campaigns.affiliateReport.revenue.orders"),
                    cell: ({ getValue, row }) =>
                        new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: row.original.currencyCode,
                        }).format(getValue()),
                    meta: { align: "right" },
                }),
                revenueColumnHelper.accessor("publisherRevenue", {
                    header: t("campaigns.affiliateReport.revenue.commission"),
                    cell: ({ getValue, row }) =>
                        new Intl.NumberFormat(locale, {
                            style: "currency",
                            currency: row.original.currencyCode,
                        }).format(getValue()),
                    meta: { align: "right" },
                }),
            ] as ColumnDef<RevenueRow>[],
        [t, locale]
    );

    if (revenue.length === 0) {
        return (
            <Card radius="m">
                <Stack space="s">
                    <Text as="h2" variant="bodySmall" color="secondary">
                        {t("campaigns.affiliateReport.revenue.title")}
                    </Text>
                    <Text as="span" variant="caption" color="tertiary">
                        {t("campaigns.affiliateReport.noData")}
                    </Text>
                </Stack>
            </Card>
        );
    }

    return (
        <Card radius="m">
            <Stack space="s">
                <Text as="h2" variant="bodySmall" color="secondary">
                    {t("campaigns.affiliateReport.revenue.title")}
                </Text>
                <Table data={revenue} columns={columns} enableSorting={false} />
            </Stack>
        </Card>
    );
}
