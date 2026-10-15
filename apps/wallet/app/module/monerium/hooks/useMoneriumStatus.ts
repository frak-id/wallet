import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumStatusPending,
    type MoneriumStatus,
} from "@/module/monerium/utils/deriveSetupScreen";
import { isMoneriumEnabled } from "@/module/monerium/utils/moneriumConfig";
import {
    isMoneriumRetryable,
    unwrapMoneriumResponse,
} from "@/module/monerium/utils/moneriumErrors";

const STATUS_POLL_INTERVAL_MS = 30_000;

export async function fetchMoneriumStatus(
    refresh: boolean
): Promise<MoneriumStatus> {
    return unwrapMoneriumResponse(
        await authenticatedWalletApi.monerium.status.get({
            query: refresh ? { refresh: true } : {},
        })
    );
}

type UseMoneriumStatusOptions = {
    /** Poll while a profile or wallet link is pending; only the open flow asks for it. */
    poll?: boolean;
};

export function useMoneriumStatus({
    poll = false,
}: UseMoneriumStatusOptions = {}) {
    const queryClient = useQueryClient();

    const query = useQuery({
        queryKey: moneriumKey.status,
        queryFn: () => fetchMoneriumStatus(false),
        enabled: isMoneriumEnabled,
        refetchOnWindowFocus: true,
        refetchInterval: (q) =>
            poll && isMoneriumStatusPending(q.state.data)
                ? STATUS_POLL_INTERVAL_MS
                : false,
        retry: (failureCount, error) =>
            failureCount < 2 && isMoneriumRetryable(error),
    });

    const refreshMutation = useMutation({
        mutationFn: () => fetchMoneriumStatus(true),
        onSuccess: (data) => queryClient.setQueryData(moneriumKey.status, data),
    });

    return {
        status: query.data,
        isLoading: query.isLoading,
        isError: query.isError,
        error: query.error,
        refetch: query.refetch,
        refresh: refreshMutation.mutateAsync,
        isRefreshing: refreshMutation.isPending,
        refreshError: refreshMutation.error,
    };
}
