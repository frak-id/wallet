import { getSession } from "@/context/session/action/session";
import { useQuery } from "@tanstack/react-query";

/**
 * Simple hook to fetch the current user session from the client side
 */
export function useSession(
    { enabled }: { enabled: boolean } = { enabled: true }
) {
    const {
        data: session,
        isLoading: isFetchingSession,
        isSuccess,
        isError,
        refetch: refetchSession,
    } = useQuery({
        queryKey: ["session"],
        queryFn: async () => {
            // Just fetch the session
            return await getSession();
        },
        refetchOnMount: "always",
        enabled,
    });
    return { session, refetchSession, isFetchingSession, isSuccess, isError };
}
