import { useQuery } from "@tanstack/react-query";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import {
    getProfiles,
    isMoneriumRetryable,
} from "@/module/monerium/utils/moneriumApi";

export function useMoneriumProfile() {
    const isConnected = moneriumStore(isMoneriumConnected);

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: moneriumKey.profile,
        queryFn: async () => {
            const { profiles } = await getProfiles();
            return profiles[0] ?? null;
        },
        enabled: isConnected,
        refetchOnWindowFocus: true,
        refetchInterval: (query) => {
            if (query.state.data?.state === "pending") return 30_000;
            return false;
        },
        retry: (failureCount, err) =>
            failureCount < 3 && isMoneriumRetryable(err),
    });

    return {
        profile: data ?? null,
        profileId: data?.id ?? null,
        profileState: data?.state ?? null,
        isLoading,
        error,
        refetch,
    };
}
