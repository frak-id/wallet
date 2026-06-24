import { ProgressBar } from "@frak-labs/design-system/components/ProgressBar";
import { Skeleton } from "@frak-labs/design-system/components/Skeleton";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { createColumnHelper } from "@tanstack/react-table";
import { format } from "date-fns";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Table } from "@/module/common/component/Table";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { getDateFnsLocale } from "@/module/common/utils/dateLocale";
import { pushHistoryStore } from "@/stores/pushHistoryStore";
import { CellRowMenu } from "./CellRowMenu";
import { PushHistoryFilters } from "./Filters";
import { filterPushHistory } from "./filterPushHistory";
import { PushHistoryStatusBadge } from "./PushHistoryStatusBadge";
import * as styles from "./push-history.css";
import type { PushHistoryItem } from "./types";
import { usePushHistory } from "./usePushHistory";

const columnHelper = createColumnHelper<PushHistoryItem>();

/**
 * History of every push broadcast sent (or scheduled) for the active
 * merchant: filters on top, then a table mirroring the design layout.
 */
export function PushHistory() {
    const { t, i18n } = useTranslation();
    const merchantId = useActiveMerchantId();
    const { data: history, isPending } = usePushHistory(merchantId);
    const filters = pushHistoryStore((state) => state.filters);

    const rows = useMemo(
        () =>
            history
                ? // Most recent programmation date first (scheduled or sent).
                  filterPushHistory(history, filters).sort(
                      (a, b) => b.scheduledAt - a.scheduledAt
                  )
                : [],
        [history, filters]
    );

    const columns = useMemo(
        () => [
            columnHelper.accessor("title", {
                // Notification is a fixed 285px column per the design; the
                // other columns split the remaining width equally.
                size: 285,
                header: () => t("push.history.columns.notification"),
                cell: ({ getValue }) => (
                    <span
                        className={styles.notificationCell}
                        title={getValue()}
                    >
                        {getValue()}
                    </span>
                ),
            }),
            columnHelper.accessor("status", {
                header: () => t("push.history.columns.status"),
                cell: ({ getValue }) => (
                    <PushHistoryStatusBadge status={getValue()} />
                ),
            }),
            columnHelper.accessor("scheduledAt", {
                header: () => t("push.history.columns.scheduledFor"),
                cell: ({ getValue }) =>
                    format(getValue(), "MMM d, yyyy - HH:mm", {
                        locale: getDateFnsLocale(i18n.language),
                    }),
            }),
            columnHelper.accessor("walletCount", {
                header: () => t("push.history.columns.audience"),
                cell: ({ getValue }) => {
                    const walletCount = getValue();
                    return walletCount === null
                        ? t("push.history.audience.all")
                        : t("push.history.audience.members", {
                              count: walletCount,
                          });
                },
            }),
            columnHelper.display({
                id: "sentOpened",
                header: () => t("push.history.columns.sentOpened"),
                cell: ({ row }) => <SentOpenedCell item={row.original} />,
            }),
            columnHelper.display({
                id: "actions",
                size: 48,
                meta: { align: "right" },
                cell: ({ row }) => <CellRowMenu item={row.original} />,
            }),
        ],
        [t, i18n.language]
    );

    if (!history || isPending) {
        return <Skeleton variant="rect" height={250} />;
    }

    return (
        <Stack space="l">
            <PushHistoryFilters />
            <Table
                data={rows}
                columns={columns}
                emptyPlaceholder="–"
                enableSorting={false}
                fixedLayout={true}
            />
        </Stack>
    );
}

/**
 * "Sent / Opened" cell: an `opened` / `sent` counter row over a thin
 * open-rate progress bar. Scheduled broadcasts have no stats yet, so they
 * show a muted dash.
 */
function SentOpenedCell({ item }: { item: PushHistoryItem }) {
    if (item.opened === null || item.sent === null) {
        return (
            <Text as="span" variant="bodySmall" color="tertiary">
                –
            </Text>
        );
    }
    const ratio = item.sent > 0 ? (item.opened / item.sent) * 100 : 0;
    return (
        <div className={styles.sentOpened}>
            <div className={styles.sentOpenedRow}>
                <span className={styles.sentOpenedValue}>
                    {item.opened.toLocaleString()}
                </span>
                <span className={styles.sentOpenedTotal}>
                    /{item.sent.toLocaleString()}
                </span>
            </div>
            <ProgressBar value={ratio} tone="primary" height={4} />
        </div>
    );
}
