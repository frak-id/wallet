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
import type { TFunction } from "i18next";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
    backendBaseUrl,
    businessAuthHeaders,
    stepUpAwareFetch,
} from "@/api/backendClient";
import { ConfirmDialog } from "@/module/common/component/ConfirmDialog";
import { useSettingsMerchantId } from "@/module/common/hook/useSettingsMerchantId";
import {
    getDateTimeFormat,
    getNumberFormat,
} from "@/module/common/utils/intlCache";
import { useMyMerchants } from "@/module/dashboard/hooks/useMyMerchants";
import type { BillingEntry } from "../types";
import { useVoidDocument } from "../useBillingAdmin";
import { useBillingInfo } from "../useBillingInfo";
import * as styles from "./billing-table.css";

/** Badge variant per entry kind — invoice (paid) / deposit / withdraw each get a distinct tag. */
function badgeVariantFor(kind: BillingEntry["kind"]) {
    switch (kind) {
        case "invoice":
            return "success" as const;
        case "withdraw":
            return "warning" as const;
        default:
            return "info" as const;
    }
}

/** Badge label per entry kind. */
function badgeLabelFor(t: TFunction, kind: BillingEntry["kind"]): string {
    switch (kind) {
        case "invoice":
            return t("settings.billing.tag.paid");
        case "withdraw":
            return t("settings.billing.tag.withdraw");
        default:
            return t("settings.billing.tag.deposit");
    }
}

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
        const dateFmt = getDateTimeFormat(i18n.language, {
            day: "2-digit",
            month: "short",
            year: "numeric",
            // Dates are calendar-only (no time) — format in UTC so a
            // negative-offset timezone doesn't render the previous day.
            timeZone: "UTC",
        });
        const numberFmt = getNumberFormat(i18n.language, {
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
                                variant={badgeVariantFor(entry.kind)}
                            >
                                {badgeLabelFor(t, entry.kind)}
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
    const merchantId = useSettingsMerchantId();
    const [isDownloading, setIsDownloading] = useState(false);
    const [hasError, setHasError] = useState(false);

    async function handleDownload() {
        if (!merchantId) return;
        setIsDownloading(true);
        setHasError(false);
        try {
            // The PDF is served as `application/pdf`, which eden-treaty parses
            // as text (corrupting the bytes) — so fetch the binary directly.
            // Hitting this endpoint also lazily generates the PDF if a prior
            // render failed, so it works even when `entry.hasPdf` is false.
            // Routed through `stepUpAwareFetch` (§2.10) so a future step-up
            // gate on this endpoint opens the 2FA modal and retries instead of
            // failing opaquely as a plain 401.
            const response = await stepUpAwareFetch(
                `${backendBaseUrl}/business/merchant/${merchantId}/billing/documents/${entry.id}/pdf`,
                {
                    credentials: "include",
                    headers: businessAuthHeaders(),
                }
            );
            if (!response.ok) {
                setHasError(true);
                return;
            }

            const blob = await response.blob();
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
        } catch {
            setHasError(true);
        } finally {
            setIsDownloading(false);
        }
    }

    return (
        <span className={styles.pdfCell}>
            <button
                type="button"
                className={styles.pdfButton}
                aria-label={t("settings.billing.table.download")}
                disabled={isDownloading}
                onClick={handleDownload}
            >
                <DownloadIcon />
            </button>
            {hasError && (
                <Text variant="caption" color="error">
                    {t("settings.billing.table.downloadError")}
                </Text>
            )}
        </span>
    );
}

function VoidDocumentButton({ entry }: { entry: BillingEntry }) {
    const { t } = useTranslation();
    const merchantId = useSettingsMerchantId();
    const [confirmOpen, setConfirmOpen] = useState(false);
    const voidDocument = useVoidDocument(merchantId ?? "");

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
