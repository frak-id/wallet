import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";
import { selectSession, sessionStore } from "../../stores/sessionStore";
import { ensureFreshSdkSession } from "../auth/ensureFreshSdkSession";
import { sdkKey } from "../queryKeys/sdk";

/**
 * Thin react-query wrapper around ensureFreshSdkSession.
 *
 * Provides in-component caching and single-flight for the Ring-1 (React) path.
 * The underlying ensureFreshSdkSession also dedupes the Ring-0 (listener) path
 * via a module-level in-flight promise.
 *
 * Returns:
 *  - sdkSession: the current SDK session token (null when dead/unavailable)
 *  - getSdkSession: force a refetch
 */
export function useGetSafeSdkSession() {
    const currentSession = useStore(sessionStore, selectSession);

    const query = useQuery({
        // Keep in memory for 2 min
        gcTime: 2 * 60 * 1000,
        // Consider stale after 15 min (will renew proactively via ensureFreshSdkSession)
        staleTime: 15 * 60 * 1000,
        queryKey: sdkKey.token.bySession(currentSession?.address),
        queryFn: async () => {
            const result = await ensureFreshSdkSession();
            if (result.status === "dead") return null;
            return result.sdk ?? null;
        },
    });

    return {
        sdkSession: query.data,
        getSdkSession: query.refetch,
        ...query,
    };
}
