import { useQuery } from "@tanstack/react-query";
import { moneriumKey } from "@/module/monerium/queryKeys/monerium";
import {
    isMoneriumConnected,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import { getProfiles } from "@/module/monerium/utils/moneriumApi";
import { useMoneriumTokenRefresh } from "./useMoneriumClient";

export function useMoneriumProfile() {
    const isConnected = moneriumStore(isMoneriumConnected);
    const accessToken = moneriumStore((s) => s.accessToken);
    const { isReady } = useMoneriumTokenRefresh();

    const { data, isLoading, error, refetch } = useQuery({
        queryKey: moneriumKey.profile,
        queryFn: async () => {
            try {
                const { profiles } = await getProfiles();
                const profile = profiles[0];

                if (!profile) {
                    return null;
                }

                return {
                    profileId: profile.id,
                    profileState: profile.state,
                };
            } catch (error) {
                if (error instanceof Error && error.message.includes("401")) {
                    moneriumStore.getState().disconnect();
                }
                throw error;
            }
        },
        enabled: isConnected && isReady && !!accessToken,
        refetchOnWindowFocus: true,
        refetchInterval: (query) => {
            if (query.state.data?.profileState === "pending") return 30_000;
            return false;
        },
    });

    return {
        profileId: data?.profileId ?? null,
        profileState: data?.profileState ?? null,
        isLoading,
        error,
        refetch,
    };
}
