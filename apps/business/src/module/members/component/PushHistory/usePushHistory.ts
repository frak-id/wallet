import type { PushBroadcast } from "@frak-labs/backend-elysia/domain/notifications";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import type { PushHistoryItem } from "./types";

const historyQueryKey = (merchantId: string) =>
    ["push", "history", merchantId] as const;

/**
 * Derive a history table row from a raw broadcast: status (pending scheduled
 * vs sent), nulled stats while scheduled, and a flattened payload/audience.
 */
function toPushHistoryItem(broadcast: PushBroadcast): PushHistoryItem {
    const isScheduled =
        broadcast.scheduledAt !== null && broadcast.claimedAt === null;
    const walletCount =
        broadcast.targets && "wallets" in broadcast.targets
            ? broadcast.targets.wallets.length
            : null;
    return {
        id: broadcast.id,
        title: broadcast.payload.title,
        status: isScheduled ? "scheduled" : "sent",
        scheduledAt: broadcast.scheduledAt ?? broadcast.createdAt,
        walletCount,
        sent: isScheduled ? null : broadcast.sentCount,
        opened: isScheduled ? null : broadcast.openedCount,
        payload: {
            title: broadcast.payload.title,
            body: broadcast.payload.body,
            icon: broadcast.payload.icon,
            url: broadcast.payload.data?.url,
        },
        target: broadcast.targets ?? undefined,
        targetCount: walletCount ?? broadcast.sentCount,
    };
}

/**
 * Fetch the push-notification broadcast history for a merchant.
 *
 * Hits `GET /business/notifications/broadcasts` and maps the DB-shaped rows
 * into the `PushHistoryItem` view model the table consumes. The query key is
 * scoped by merchant so cache isolation stays correct when switching merchants.
 */
export function usePushHistory(merchantId: string) {
    return useQuery({
        queryKey: historyQueryKey(merchantId),
        queryFn: async (): Promise<PushHistoryItem[]> => {
            const { data, error } =
                await authenticatedBackendApi.notifications.broadcasts.get({
                    query: { merchantId },
                });
            if (error) {
                throw new Error("Failed to load push notification history");
            }
            return (data ?? []).map(toPushHistoryItem);
        },
        enabled: !!merchantId,
    });
}

/**
 * Delete a push broadcast from the history.
 *
 * Hits `DELETE /business/notifications/broadcasts/:id`, then drops the row from
 * the cached list on success so the table updates without a refetch.
 */
export function useDeletePushBroadcast(merchantId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["push", "history", "delete", merchantId],
        mutationFn: async (id: string): Promise<string> => {
            const { error } = await authenticatedBackendApi.notifications
                .broadcasts({ id })
                .delete({}, { query: { merchantId } });
            if (error) {
                throw new Error("Failed to delete push notification");
            }
            return id;
        },
        onSuccess: (id) => {
            queryClient.setQueryData<PushHistoryItem[]>(
                historyQueryKey(merchantId),
                (prev) => prev?.filter((item) => item.id !== id) ?? []
            );
        },
    });
}
