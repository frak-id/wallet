import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PushHistoryItem } from "./types";

const historyQueryKey = (merchantId: string) =>
    ["push", "history", merchantId] as const;

/**
 * Mock push-broadcast history.
 *
 * Mirrors the reference design data. Replace the queryFn with the real
 * `GET /notifications/broadcasts` call once the backend list endpoint lands —
 * the returned shape (`PushHistoryItem[]`) is intentionally endpoint-ready.
 */
const MOCK_HISTORY: PushHistoryItem[] = [
    {
        id: "summer-sale",
        title: "Summer sale is live — 25% off everything this weekend only",
        status: "scheduled",
        scheduledAt: new Date("2026-06-20T10:00:00").getTime(),
        audienceLabel: "All members",
        sent: null,
        opened: null,
        payload: {
            title: "Summer sale is live",
            body: "Enjoy 25% off everything this weekend only.",
            url: "https://shop.example.com/summer-sale",
        },
        target: { filter: {} },
        targetCount: 1500,
    },
    {
        id: "referral-bonus",
        title: "New referral bonus tier",
        status: "scheduled",
        scheduledAt: new Date("2026-06-15T14:30:00").getTime(),
        audienceLabel: "812 members",
        sent: null,
        opened: null,
        payload: {
            title: "New referral bonus tier",
            body: "Invite friends and earn more rewards on every referral.",
            url: "https://shop.example.com/referral",
        },
        target: { filter: {} },
        targetCount: 812,
    },
    {
        id: "launch-prd",
        title: "Launch Prd",
        status: "sent",
        scheduledAt: new Date("2026-06-05T10:00:00").getTime(),
        audienceLabel: "1,204 members",
        sent: 1204,
        opened: 500,
        payload: {
            title: "We just launched!",
            body: "Discover our new product line, available now.",
            url: "https://shop.example.com/launch",
        },
        target: { filter: {} },
        targetCount: 1204,
    },
];

/**
 * Fetch the push-notification broadcast history for a merchant.
 *
 * Currently returns mock data; the query key is already scoped by merchant so
 * swapping in the real endpoint keeps cache isolation correct.
 */
export function usePushHistory(merchantId: string) {
    return useQuery({
        queryKey: historyQueryKey(merchantId),
        queryFn: async (): Promise<PushHistoryItem[]> => MOCK_HISTORY,
    });
}

/**
 * Delete a push broadcast from the history.
 *
 * Mock implementation: drops the row from the cached list. Swap the mutationFn
 * for the real `DELETE /notifications/broadcasts/:id` call when it lands.
 */
export function useDeletePushBroadcast(merchantId: string) {
    const queryClient = useQueryClient();
    return useMutation({
        mutationKey: ["push", "history", "delete", merchantId],
        mutationFn: async (id: string): Promise<string> => id,
        onSuccess: (id) => {
            queryClient.setQueryData<PushHistoryItem[]>(
                historyQueryKey(merchantId),
                (prev) => prev?.filter((item) => item.id !== id) ?? []
            );
        },
    });
}
