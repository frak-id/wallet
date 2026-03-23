import { useMutation } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import {
    isMoneriumTokenExpired,
    moneriumStore,
} from "@/module/monerium/store/moneriumStore";
import { refreshAccessToken } from "@/module/monerium/utils/moneriumApi";

export function useMoneriumTokenRefresh() {
    const accessToken = moneriumStore((s) => s.accessToken);
    const refreshToken = moneriumStore((s) => s.refreshToken);
    const isTokenExpired = moneriumStore(isMoneriumTokenExpired);

    const refreshAttemptedRef = useRef(false);

    const isReady = accessToken !== null && !isTokenExpired;

    const { mutate, isPending: isRefreshing } = useMutation({
        mutationFn: refreshAccessToken,
        onSuccess: (tokens) => {
            moneriumStore
                .getState()
                .setTokens(
                    tokens.access_token,
                    tokens.refresh_token,
                    tokens.expires_in
                );
        },
        onError: () => {
            moneriumStore.getState().disconnect();
        },
    });

    useEffect(() => {
        if (!refreshToken) {
            refreshAttemptedRef.current = false;
            return;
        }

        if (accessToken && !isTokenExpired) {
            return;
        }

        if (refreshAttemptedRef.current) {
            return;
        }

        refreshAttemptedRef.current = true;
        mutate(refreshToken);
    }, [accessToken, refreshToken, isTokenExpired, mutate]);

    return {
        accessToken: isReady ? accessToken : null,
        isReady,
        isRefreshing,
    };
}
