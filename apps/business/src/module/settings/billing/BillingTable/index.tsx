import { Badge } from "@frak-labs/design-system/components/Badge";
import { Card } from "@frak-labs/design-system/components/Card";
import { Stack } from "@frak-labs/design-system/components/Stack";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@frak-labs/design-system/components/Table";
import {
    Tabs,
    TabsContent,
    TabsList,
    TabsTrigger,
} from "@frak-labs/design-system/components/Tabs";
import { Text } from "@frak-labs/design-system/components/Text";
import { BinIcon, DownloadIcon } from "@frak-labs/design-system/icons";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { authenticatedBackendApi } from "@/api/backendClient";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import type { BillingEntry } from "../types";
import { useVoidDocument } from "../useBillingAdmin";
import { useBillingInfo } from "../useBillingInfo";
import * as styles from "./billing-table.css";

/**
 * Billing history card: segmented Invoices / Deposit control over a read-only
 * data table (Date / Amount / Type / Description / PDF). Platform admins
 * additionally get a per-row void action (deposit/withdraw only — monthly
 * bills have no void route).
 */
export function BillingTable() {
    const { t } = useTranslation();
    const { invoices, deposits } = useBillingInfo();
    const { isPlatformAdmin } = useMyMerchants();

    return (
        <Card variant="elevated" radius="m">
            <Tabs defaultValue="invoices">
                <Stack space="m">
                    <TabsList variant="segmented" fullWidth>
                        <TabsTrigger
                            variant="segmented"
                            fullWidth
                            value="invoices"
                        >
                            {t("settings.billing.segments.invoices")}
                        </TabsTrigger>
                        <TabsTrigger
                            variant="segmented"
                            fullWidth
                            value="deposit"
                        >
                            {t("settings.billing.segments.deposit")}
                        </TabsTrigger>
                    </TabsList>
                    <TabsContent value="invoices">
                        <EntriesTable
                            entries={invoices}
                            canVoid={isPlatformAdmin}
                        />
                    </TabsContent>
                    <TabsContent value="deposit">
                        <EntriesTable
                            entries={deposits}
                            canVoid={isPlatformAdmin}
                        />
                    </TabsContent>
                </Stack>
            </Tabs>
        </Card>
    );
}

function EntriesTable({
    entries,
    canVoid,
}: {
    entries: BillingEntry[];
    canVoid: boolean;
}) {
    const { t, i18n } = useTranslation();

    const { formatDate, formatAmount } = useMemo(() => {
        const dateFmt = new Intl.DateTimeFormat(i18n.language, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            // Dates are calendar-only (no time) — format in UTC so a
            // negative-offset timezone doesn't render the previous day.
            timeZone: "UTC",
        });
        const numberFmt = new Intl.NumberFormat(i18n.language, {
            maximumFractionDigits: 2,
        });
        return {
            formatDate: (iso: string) => dateFmt.format(new Date(iso)),
            // Stablecoin currencies (eure/gbpe/usde/usdc) aren't ISO-4217 codes,
            // so `Intl.NumberFormat({ style: "currency" })` can't be used here.
            formatAmount: (amount: number | null, currency: string) =>
                amount === null
                    ? "—"
                    : `${numberFmt.format(amount)} ${currency.toUpperCase()}`,
        };
    }, [i18n.language]);

    return (
        <Table>
            <TableHeader>
                <TableRow>
                    <TableHead>{t("settings.billing.table.date")}</TableHead>
                    <TableHead align="right">
                        {t("settings.billing.table.amount")}
                    </TableHead>
                    <TableHead hug>
                        {t("settings.billing.table.type")}
                    </TableHead>
                    <TableHead>
                        {t("settings.billing.table.description")}
                    </TableHead>
                    <TableHead align="right" hug>
                        {t("settings.billing.table.pdf")}
                    </TableHead>
                    {canVoid && (
                        <TableHead align="right" hug>
                            {t("settings.billing.admin.table.void")}
                        </TableHead>
                    )}
                </TableRow>
            </TableHeader>
            <TableBody>
                {entries.map((entry) => (
                    <TableRow key={entry.id}>
                        <TableCell>{formatDate(entry.date)}</TableCell>
                        <TableCell align="right" className={styles.amount}>
                            {formatAmount(entry.amount, entry.currency)}
                        </TableCell>
                        <TableCell hug>
                            <Badge
                                size="small"
                                variant={
                                    entry.kind === "invoice"
                                        ? "success"
                                        : "info"
                                }
                            >
                                {entry.kind === "invoice"
                                    ? t("settings.billing.tag.paid")
                                    : t("settings.billing.tag.deposit")}
                            </Badge>
                        </TableCell>
                        <TableCell muted>{entry.description}</TableCell>
                        <TableCell align="right" hug>
                            <DownloadPdfButton entry={entry} />
                        </TableCell>
                        {canVoid && (
                            <TableCell align="right" hug>
                                {entry.rawKind !== "monthly_bill" && (
                                    <VoidDocumentButton entry={entry} />
                                )}
                            </TableCell>
                        )}
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

function DownloadPdfButton({ entry }: { entry: BillingEntry }) {
    const { t } = useTranslation();
    const merchantId = useActiveMerchantId();
    const [isDownloading, setIsDownloading] = useState(false);

    async function handleDownload() {
        setIsDownloading(true);
        try {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.documents({ id: entry.id })
                .pdf.get();
            if (error || !data) return;

            const blob = await data.blob();
            const url = URL.createObjectURL(blob);
            const link = document.createElement("a");
            link.href = url;
            link.download = `${entry.reference}.pdf`;
            // Firefox/Safari don't trigger a download from a detached anchor's
            // .click() — it must be in the DOM. Revoke asynchronously so the
            // browser has finished reading the blob before the URL dies.
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            setTimeout(() => URL.revokeObjectURL(url), 0);
        } finally {
            setIsDownloading(false);
        }
    }

    return (
        <button
            type="button"
            className={styles.pdfButton}
            aria-label={t("settings.billing.table.download")}
            disabled={!entry.hasPdf || isDownloading}
            onClick={handleDownload}
        >
            <DownloadIcon />
        </button>
    );
}

function VoidDocumentButton({ entry }: { entry: BillingEntry }) {
    const { t } = useTranslation();
    const merchantId = useActiveMerchantId();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const voidDocument = useVoidDocument(merchantId);

    // Narrowed by the caller (`rawKind !== "monthly_bill"`), but the mutation
    // input type only accepts "deposit" | "withdraw" — re-assert here so this
    // component has no reachable path to call it with "monthly_bill".
    if (entry.rawKind === "monthly_bill") return null;
    const kind = entry.rawKind;

    return (
        <>
            <button
                type="button"
                className={styles.pdfButton}
                aria-label={t("settings.billing.admin.table.voidAria", {
                    reference: entry.reference,
                })}
                onClick={() => setConfirmOpen(true)}
            >
                <BinIcon />
            </button>
            <ConfirmDialog
                open={confirmOpen}
                onOpenChange={(next) => {
                    setConfirmOpen(next);
                    if (!next) voidDocument.reset();
                }}
                title={t("settings.billing.admin.void.title")}
                description={t("settings.billing.admin.void.description", {
                    reference: entry.reference,
                })}
                cancelLabel={t("settings.billing.actions.cancel")}
                confirmLabel={t("settings.billing.admin.void.confirm")}
                confirmTone="destructive"
                isConfirming={voidDocument.isPending}
                error={
                    voidDocument.isError ? (
                        <Text variant="caption" color="error">
                            {t("settings.billing.admin.errors.void")}
                        </Text>
                    ) : undefined
                }
                onConfirm={() => {
                    voidDocument.mutate(
                        { id: entry.id, kind },
                        { onSuccess: () => setConfirmOpen(false) }
                    );
                }}
            />
        </>
    );
}
