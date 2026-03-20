import { useQuery } from "@tanstack/react-query";
import {
    moneriumStore,
    selectAccessToken,
    selectIsConnected,
    selectProfileId,
} from "@/module/monerium/store/moneriumStore";
import { getProfiles } from "@/module/monerium/utils/moneriumApi";
import { useMoneriumTokenRefresh } from "./useMoneriumClient";

function isAuthError(error: unknown): boolean {
    if (error instanceof Error) {
        return (
            error.message.includes("401") ||
            error.message.toLowerCase().includes("unauthorized")
        );
    }
    if (typeof error === "object" && error !== null) {
        const err = error as Record<string, unknown>;
        return err.status === 401 || err.statusCode === 401;
    }
    return false;
}

export function useMoneriumStatus() {
    const isConnected = moneriumStore(selectIsConnected);
    const profileId = moneriumStore(selectProfileId);
    const accessToken = moneriumStore(selectAccessToken);
    const { isReady } = useMoneriumTokenRefresh();

    const {
        data: profileState,
        isLoading,
        error,
        refetch,
    } = useQuery({
        queryKey: ["monerium", "status", profileId],
        queryFn: async () => {
            if (!accessToken) {
                return null;
            }

            try {
                const { profiles } = await getProfiles(accessToken);
                const profile = profiles[0];

                if (!profile) {
                    return null;
                }

                const state = profile.state;

                moneriumStore.getState().setProfileState(state);

                return state;
            } catch (error) {
                if (isAuthError(error)) {
                    moneriumStore.getState().disconnect();
                }
                throw error;
            }
        },
        enabled: isConnected && isReady && !!accessToken,
        refetchOnWindowFocus: true,
        refetchInterval: (query) => {
            if (query.state.data === "pending") return 30_000;
            return false;
        },
    });

    return {
        profileState,
        isLoading,
        error,
        refetch,
    };
}
