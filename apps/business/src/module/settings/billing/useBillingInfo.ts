import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import { useActiveMerchantId } from "@/module/common/hook/useActiveMerchantId";
import { accountingQueryKey, documentsQueryKey } from "./queryKeys";
import type { BillingEntry, BillingInfo } from "./types";

function toBillingEntry(doc: {
    id: string;
    kind: "deposit" | "withdraw" | "monthly_bill";
    reference: string;
    documentDate: string;
    currency: string;
    grossAmount: string | null;
    pdfGeneratedAt: string | null;
}): BillingEntry {
    return {
        id: doc.id,
        date: doc.documentDate,
        amount: doc.grossAmount ? Number.parseFloat(doc.grossAmount) : null,
        currency: doc.currency,
        kind: doc.kind === "monthly_bill" ? "invoice" : "deposit",
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
    const merchantId = useActiveMerchantId();
    const queryClient = useQueryClient();

    const accountingQuery = useQuery({
        queryKey: accountingQueryKey(merchantId),
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.accounting.get();
            if (error) throw error;
            return data.accountingInfo;
        },
    });

    const documentsQuery = useQuery({
        queryKey: documentsQueryKey(merchantId),
        queryFn: async () => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.documents.get({ query: {} });
            if (error) throw error;
            return data.documents;
        },
    });

    const saveMutation = useMutation({
        mutationFn: async (next: BillingInfo) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.accounting.put(next);
            if (error) throw error;
        },
        onSuccess: async () => {
            await queryClient.invalidateQueries({
                queryKey: accountingQueryKey(merchantId),
            });
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
        saveInfo: (next: BillingInfo) => saveMutation.mutate(next),
        isLoading: accountingQuery.isLoading || documentsQuery.isLoading,
        isSaving: saveMutation.isPending,
    };
}
