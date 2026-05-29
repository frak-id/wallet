import { Text } from "@frak-labs/design-system/components/Text";
import { type ColumnDef, createColumnHelper } from "@tanstack/react-table";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import { Table } from "@/module/common/component/Table";
import { truncateWallet, useDetailFormatters } from "./parts";

type Ambassador = CampaignDetailsStats["topAmbassadors"][number];

const columnHelper = createColumnHelper<Ambassador>();

/**
 * Top-3 ranks show a medal; the rest show the number (Figma leaderboard).
 * The medal is exposed to assistive tech as its rank number so it reads
 * consistently with rows 4+.
 */
function rankLabel(rank: number) {
    if (rank > 3) {
        return rank;
    }
    return (
        <span role="img" aria-label={String(rank)}>
            {["🥇", "🥈", "🥉"][rank - 1]}
        </span>
    );
}

export function TopAmbassadorsTable({
    topAmbassadors,
}: {
    topAmbassadors: CampaignDetailsStats["topAmbassadors"];
}) {
    const { t } = useTranslation();
    const fmt = useDetailFormatters();

    const columns = useMemo(
        () =>
            [
                columnHelper.display({
                    id: "rank",
                    size: 38,
                    header: t("campaigns.details.top.rank"),
                    cell: ({ row }) => rankLabel(row.index + 1),
                }),
                columnHelper.accessor("wallet", {
                    size: 150,
                    header: t("campaigns.details.top.wallet"),
                    cell: ({ getValue }) => truncateWallet(getValue()),
                }),
                columnHelper.accessor("shares", {
                    size: 71,
                    header: t("campaigns.details.top.shares"),
                    meta: { align: "right" },
                    cell: ({ getValue }) => (
                        <Text as="span" variant="bodySmall" weight="medium">
                            {fmt.integer.format(getValue())}
                        </Text>
                    ),
                }),
                columnHelper.accessor("sales", {
                    size: 61,
                    header: t("campaigns.details.top.sales"),
                    meta: { align: "right" },
                    cell: ({ getValue }) => (
                        <Text as="span" variant="bodySmall" weight="medium">
                            {fmt.integer.format(getValue())}
                        </Text>
                    ),
                }),
                columnHelper.accessor("revenue", {
                    size: 153,
                    header: t("campaigns.details.top.generatedRevenue"),
                    meta: { align: "right" },
                    cell: ({ getValue }) => (
                        <Text as="span" variant="bodySmall" weight="medium">
                            {fmt.currency0.format(getValue())}
                        </Text>
                    ),
                }),
                columnHelper.accessor("earned", {
                    size: 110,
                    header: t("campaigns.details.top.earned"),
                    meta: { align: "right" },
                    cell: ({ getValue }) => (
                        <Text
                            as="span"
                            variant="bodySmall"
                            weight="medium"
                            color="success"
                        >
                            {fmt.currency.format(getValue())}
                        </Text>
                    ),
                }),
            ] as ColumnDef<Ambassador>[],
        [t, fmt]
    );

    return (
        <Table data={topAmbassadors} columns={columns} enableSorting={false} />
    );
}
