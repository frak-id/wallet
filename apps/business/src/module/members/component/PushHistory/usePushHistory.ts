import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";
import type { PushHistoryItem } from "./types";

const historyQueryKey = (merchantId: string) =>
    ["push", "history", merchantId] as const;

/**
 * Fetch the push-notification broadcast history for a merchant.
 *
 * Hits `GET /business/notifications/broadcasts`, which already returns rows in
 * the `PushHistoryItem` shape the table consumes. The query key is scoped by
 * merchant so cache isolation stays correct when switching merchants.
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
            return data ?? [];
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
