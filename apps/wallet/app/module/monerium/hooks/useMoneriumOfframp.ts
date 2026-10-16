import type { MoneriumPlaceOrderBody } from "@backend-domain/monerium/schemas";
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

export type PlaceOrderParams = Pick<
    MoneriumPlaceOrderBody,
    "orderId" | "amount" | "iban" | "counterpart" | "memo"
>;

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
            client.invalidateQueries({ queryKey: moneriumKey.status });
            trackEvent("monerium_order_failed", {
                own: counterpart.own,
                amount_bucket: getAmountBucket(amount),
                code: getMoneriumErrorCode(error) ?? "unknown",
            });
        },
    });

    return {
        placeOrder: mutation.mutate,
        placeOrderAsync: mutation.mutateAsync,
        isPending: mutation.isPending,
        isSuccess: mutation.isSuccess,
        error: mutation.error,
        reset: mutation.reset,
    };
}
