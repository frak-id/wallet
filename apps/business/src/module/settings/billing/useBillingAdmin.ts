import type { Stablecoin } from "@frak-labs/app-essentials";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import type { Hex } from "viem";
import { authenticatedBackendApi } from "@/api/backendClient";
import { documentsQueryKey } from "./queryKeys";

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
            queryClient.invalidateQueries({
                queryKey: documentsQueryKey(merchantId),
            });
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
            queryClient.invalidateQueries({
                queryKey: documentsQueryKey(merchantId),
            });
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
            queryClient.invalidateQueries({
                queryKey: documentsQueryKey(merchantId),
            });
        },
    });
}
