import {
    createDataTableColumnHelper,
    DataTable,
} from "@frak-labs/design-system/components/DataTable";
import { Text } from "@frak-labs/design-system/components/Text";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import type { CampaignDetailsStats } from "@/module/campaigns/queries/queryOptions";
import * as styles from "./campaign-details-sheet.css";
import { useDetailFormatters } from "./parts";
import { truncateWallet } from "./truncateWallet";

type Ambassador = CampaignDetailsStats["topAmbassadors"][number];

const columnHelper = createDataTableColumnHelper<Ambassador>();

export function TopAmbassadorsTable({
    topAmbassadors,
    currency,
}: {
    topAmbassadors: CampaignDetailsStats["topAmbassadors"];
    currency: string;
}) {
    const { t } = useTranslation();
    const fmt = useDetailFormatters(currency);

    const columns = useMemo(
        () =>
            columnHelper.columns([
                columnHelper.display({
                    id: "rank",
                    size: 38,
                    header: t("campaigns.details.top.rank"),
                    cell: ({ row }) => row.index + 1,
                }),
                columnHelper.accessor("wallet", {
                    size: 150,
                    header: t("campaigns.details.top.wallet"),
                    cell: ({ getValue }) => (
                        <span className={styles.wallet}>
                            {truncateWallet(getValue())}
                        </span>
                    ),
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
            ]),
        [t, fmt]
    );

    return (
        <DataTable
            data={topAmbassadors}
            columns={columns}
            emptyMessage={t("campaigns.details.top.empty")}
            enableSorting={false}
        />
    );
}
