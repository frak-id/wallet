import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation, useQuery } from "@tanstack/react-query";
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

async function fetchMoneriumStatus(refresh: boolean): Promise<MoneriumStatus> {
    return unwrapMoneriumResponse(
        await authenticatedWalletApi.monerium.status.get({
            query: refresh ? { refresh: true } : {},
        })
    );
}

const statusQuery = {
    queryKey: moneriumKey.status,
    queryFn: () => fetchMoneriumStatus(false),
    enabled: isMoneriumEnabled,
    retry: (failureCount: number, error: Error) =>
        failureCount < 2 && isMoneriumRetryable(error),
};

type UseMoneriumStatusOptions = {
    /** Poll while a profile or wallet link is pending; only the open flow asks for it. */
    poll?: boolean;
};

export function useMoneriumStatus({
    poll = false,
}: UseMoneriumStatusOptions = {}) {
    const query = useQuery({
        ...statusQuery,
        refetchInterval: (q) =>
            poll && isMoneriumStatusPending(q.state.data)
                ? STATUS_POLL_INTERVAL_MS
                : false,
    });

    return {
        status: query.data,
        isError: query.isError,
        refetch: query.refetch,
    };
}

/** Asks the backend to re-read Monerium; a newer status from any source clears the error. */
export function useMoneriumStatusRefresh() {
    const { dataUpdatedAt } = useQuery(statusQuery);
    const { mutate, mutateAsync, isPending, error, submittedAt } = useMutation({
        mutationFn: () => fetchMoneriumStatus(true),
        onSuccess: (data, _variables, _result, { client }) =>
            client.setQueryData(moneriumKey.status, data),
    });

    return {
        refresh: () => mutate(),
        refreshAsync: () => mutateAsync(),
        isRefreshing: isPending,
        refreshError: error && submittedAt > dataUpdatedAt ? error : null,
    };
}
