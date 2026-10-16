import {
    buildRedeemOrderMessage,
    MONERIUM_LIMITS,
    normalizeIban,
    normalizeRedeemAmount,
} from "@frak-labs/app-essentials/monerium";
import {
    authenticatedWalletApi,
    balanceKey,
    trackEvent,
} from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useMoneriumSignMessage } from "@/module/monerium/hooks/useMoneriumSignMessage";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import { getAmountBucket } from "@/module/monerium/utils/amountBucket";
import {
    createMoneriumError,
    getMoneriumErrorCode,
    unwrapMoneriumResponse,
} from "@/module/monerium/utils/moneriumErrors";
import { refreshStatusOnStateChange } from "@/module/monerium/utils/refreshStaleStatus";

export type PlaceOrderParams = {
    /** Generated once per recap screen so a retry cannot pay twice. */
    orderId: string;
    amount: string;
    iban: string;
    counterpart:
        | { own: true }
        | { own: false; firstName: string; lastName: string; country: string };
    memo?: string;
};

export function useMoneriumOfframp() {
    const signMessage = useMoneriumSignMessage();

    const mutation = useMutation({
        mutationFn: async ({
            orderId,
            amount,
            iban,
            counterpart,
            memo,
        }: PlaceOrderParams) => {
            const normalizedAmount = normalizeRedeemAmount(amount);
            if (!normalizedAmount) {
                throw createMoneriumError("MONERIUM_INVALID_AMOUNT");
            }
            if (
                !counterpart.own &&
                Number.parseFloat(normalizedAmount) >=
                    MONERIUM_LIMITS.THIRD_PARTY_DOCUMENT_THRESHOLD_EUR
            ) {
                throw createMoneriumError("MONERIUM_AMOUNT_LIMIT");
            }

            const message = buildRedeemOrderMessage({
                amount: normalizedAmount,
                iban,
                at: new Date(
                    Date.now() + MONERIUM_LIMITS.MESSAGE_FUTURE_OFFSET_MS
                ),
            });
            const signature = await signMessage(message);

            const placed = unwrapMoneriumResponse(
                await authenticatedWalletApi.monerium.orders.post({
                    orderId,
                    amount: normalizedAmount,
                    iban: normalizeIban(iban),
                    counterpart,
                    memo: memo?.trim() || undefined,
                    message,
                    signature,
                })
            );
            if (placed.order?.state === "rejected") {
                throw createMoneriumError("MONERIUM_ORDER_REJECTED");
            }
            return placed;
        },
        onSuccess: (_data, { amount, counterpart }, _result, { client }) => {
            trackEvent("monerium_order_placed", {
                own: counterpart.own,
                amount_bucket: getAmountBucket(amount),
            });
            client.invalidateQueries({ queryKey: moneriumKey.orders });
            client.invalidateQueries({ queryKey: moneriumKey.status });
            client.invalidateQueries({ queryKey: balanceKey.baseKey });
        },
        onError: (error, { amount, counterpart }, _result, { client }) => {
            refreshStatusOnStateChange(error, client);
            trackEvent("monerium_order_failed", {
                own: counterpart.own,
                amount_bucket: getAmountBucket(amount),
                code: getMoneriumErrorCode(error) ?? "unknown",
            });
        },
    });

    return {
        placeOrder: mutation.mutateAsync,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        isError: mutation.isError,
        error: mutation.error,
        reset: mutation.reset,
    };
}
