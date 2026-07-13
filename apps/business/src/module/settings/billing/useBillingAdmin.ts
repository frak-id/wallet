import type { Stablecoin } from "@frak-labs/app-essentials";
import {
    type QueryClient,
    useMutation,
    useQueryClient,
} from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import { documentsQueryKey } from "./queryKeys";

/**
 * A deposit/withdraw mutation returns as soon as the row is written, but its
 * side-effects settle a beat later: a reissue voids then recreates, a void
 * cascades to linked withdraws + clears the affected monthly bill's cached
 * PDF, and PDF (re)generation runs async. An invalidate fired the instant the
 * call resolves can therefore refetch the pre-settle state and leave the table
 * showing the stale document. So invalidate twice — immediately, then once
 * more after a short delay so the list converges on the final state without a
 * manual reload. The trailing pass uses the default `active`-only refetch, so
 * it no-ops (just marks stale) if the user already left the page.
 */
const SETTLE_REINVALIDATE_MS = 5_000;

function invalidateDocumentsAfterSettle(
    queryClient: QueryClient,
    merchantId: string
) {
    const queryKey = documentsQueryKey(merchantId);
    queryClient.invalidateQueries({ queryKey });
    setTimeout(() => {
        queryClient.invalidateQueries({ queryKey });
    }, SETTLE_REINVALIDATE_MS);
}

/**
 * Keeps only the country code and last 3 characters of an IBAN-shaped
 * string, masking everything in between (billing-feature-plan.md §3.5) —
 * the full IBAN must never leave the browser. The backend re-masks
 * defensively on top of this (double security), but this is the primary
 * guard: only the masked form is ever sent over the wire.
 */
export function maskIban(raw: string): string {
    const normalized = raw.replace(/\s+/g, "").toUpperCase();
    if (normalized.length < 8) {
        return "**** **** **** ****";
    }
    // Country code + the two IBAN check digits (standard, non-sensitive);
    // everything after is masked except the last 3 chars. Never fabricate the
    // check digits (they vary by IBAN) — slice them from the real value.
    const prefix = normalized.slice(0, 4);
    const last = normalized.slice(-3);
    return `${prefix} **** **** **** ${last}`;
}

export type CreateDepositInput = {
    grossAmount: string;
    currency: Stablecoin;
    documentDate: string;
    country: string;
    giftedAmount?: string;
    paymentPlatform?: "shopify" | "stripe";
    note?: string;
    txHash?: Hex;
};

export type CreateWithdrawInput = {
    remainingBankAmount: string;
    currency: Stablecoin;
    documentDate: string;
    linkedDepositId: string;
    rawIban: string;
    note?: string;
    txHash?: Hex;
};

/**
 * Platform-admin billing mutations (create deposit/withdraw, void either)
 * against the `platformAdminAuthenticated` admin routes. Every mutation
 * invalidates the merchant's documents list so the billing table refreshes.
 */
export function useCreateDeposit(merchantId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["billing", "deposits", "create", merchantId],
        mutationFn: async (input: CreateDepositInput) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.deposits.post(input);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            invalidateDocumentsAfterSettle(queryClient, merchantId);
        },
    });
}

export function useCreateWithdraw(merchantId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["billing", "withdrawals", "create", merchantId],
        mutationFn: async (input: CreateWithdrawInput) => {
            const { data, error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .billing.withdrawals.post(input);
            if (error) throw error;
            return data;
        },
        onSuccess: () => {
            invalidateDocumentsAfterSettle(queryClient, merchantId);
        },
    });
}

export function useVoidDocument(merchantId: string) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["billing", "void", merchantId],
        mutationFn: async ({
            id,
            kind,
        }: {
            id: string;
            kind: "deposit" | "withdraw";
        }) => {
            const path =
                kind === "deposit"
                    ? authenticatedBackendApi
                          .merchant({ merchantId })
                          .billing.deposits({ id })
                    : authenticatedBackendApi
                          .merchant({ merchantId })
                          .billing.withdrawals({ id });
            const { error } = await path.delete();
            if (error) throw error;
        },
        onSuccess: () => {
            invalidateDocumentsAfterSettle(queryClient, merchantId);
        },
    });
}
