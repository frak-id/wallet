import type { BillingDocumentResponse } from "@frak-labs/backend-elysia/domain/billing";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useSettingsMerchantId } from "@/module/common/hook/useSettingsMerchantId";
import { accountingQueryKey, documentsQueryKey } from "./queryKeys";
import type { BillingEntry, BillingInfo } from "./types";
import { invalidateDocumentsAfterSettle } from "./useBillingAdmin";

function toBillingEntry(doc: BillingDocumentResponse): BillingEntry {
    return {
        id: doc.id,
        date: doc.documentDate,
        amount: doc.grossAmount ? Number.parseFloat(doc.grossAmount) : null,
        currency: doc.currency,
        // `monthly_bill` -> "invoice", `deposit` -> "deposit", `withdraw` ->
        // its own "withdraw" kind, so a restitution is never displayed as an
        // actual deposit.
        kind:
            doc.kind === "monthly_bill"
                ? "invoice"
                : doc.kind === "withdraw"
                  ? "withdraw"
                  : "deposit",
        reference: doc.reference,
        description: doc.reference,
        hasPdf: doc.pdfGeneratedAt !== null,
        rawKind: doc.kind,
    };
}

/**
 * Billing info (merchant accounting details) + document history for the
 * active merchant, backed by `/:merchantId/billing/accounting` and
 * `/:merchantId/billing/documents`.
 */
export function useBillingInfo() {
    const merchantId = useSettingsMerchantId();
    const queryClient = useQueryClient();

    const accountingQuery = useQuery({
        queryKey: accountingQueryKey(merchantId ?? ""),
        enabled: !!merchantId,
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId: merchantId as string })
                .billing.accounting.get();
            if (error) throw error;
            return data.accountingInfo;
        },
    });

    const documentsQuery = useQuery({
        queryKey: documentsQueryKey(merchantId ?? ""),
        enabled: !!merchantId,
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId: merchantId as string })
                .billing.documents.get({ query: {} });
            if (error) throw error;
            return data.documents;
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (next: BillingInfo) => {
            if (!merchantId) throw new Error("No active merchant");
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.accounting.put(next);
            if (error) throw error;
        },
        onSuccess: async () => {
            // Refresh the accounting info immediately, and settle-invalidate the
            // documents list (same helper as deposit/withdraw mutations):
            // saving the info emits `merchantAccountingUpdated`, which wakes the
            // async monthly-bill sweep, so any bills that just became eligible
            // land a beat later — the trailing reinvalidate converges the table
            // on them without a manual reload.
            await queryClient.invalidateQueries({
                queryKey: accountingQueryKey(merchantId ?? ""),
            });
            invalidateDocumentsAfterSettle(queryClient, merchantId ?? "");
        },
    });

    const rawInfo = accountingQuery.data;
    const info: BillingInfo | null = rawInfo
        ? {
              companyName: rawInfo.companyName ?? "",
              vatNumber: rawInfo.vatNumber ?? "",
              streetAddress: rawInfo.streetAddress ?? "",
              city: rawInfo.city ?? "",
              postalCode: rawInfo.postalCode ?? "",
              country: rawInfo.country ?? "",
              billingEmail: rawInfo.billingEmail ?? "",
          }
        : null;

    const documents = documentsQuery.data ?? [];
    const invoices = documents
        .filter((doc) => doc.kind === "monthly_bill")
        .map(toBillingEntry);
    const deposits = documents
        .filter((doc) => doc.kind === "deposit" || doc.kind === "withdraw")
        .map(toBillingEntry);

    return {
        info,
        hasInfo: info !== null,
        invoices,
        deposits,
        // `onSuccess` only fires when the PUT succeeded — the sheet uses it
        // to close itself, so a failed save keeps the form (and its edits)
        // open with an inline error instead of silently dropping them (B12).
        saveInfo: (next: BillingInfo, opts?: { onSuccess?: () => void }) =>
            saveMutation.mutate(next, { onSuccess: opts?.onSuccess }),
        isLoading: accountingQuery.isLoading || documentsQuery.isLoading,
        isSaving: saveMutation.isPending,
        saveFailed: saveMutation.isError,
        resetSaveState: saveMutation.reset,
    };
}
