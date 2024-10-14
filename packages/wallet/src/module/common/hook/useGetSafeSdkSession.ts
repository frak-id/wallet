import { backendApi } from "@frak-labs/shared/context/server";
import { jotaiStore } from "@module/atoms/store";
import { useQuery } from "@tanstack/react-query";
import { sdkSessionAtom } from "../atoms/session";

/**
 * Get a safe SDK token
 */
export function useGetSafeSdkSession() {
    const query = useQuery({
        // keep in mem for 2min
        gcTime: 2 * 60 * 1000,
        queryKey: ["sdk-token", "get-safe"],
        queryFn: async () => {
            const currentSession = jotaiStore.get(sdkSessionAtom);

            // If we got a current token, check it's validity
            if (currentSession) {
                const isValid = await backendApi.auth.walletSdk.isValid.get({
                    headers: {
                        "x-wallet-sdk-auth": currentSession.token,
                    },
                });
                if (isValid) {
                    return currentSession;
                }
            }

            // Otherwise, craft a new token
            const { data, error } =
                await backendApi.auth.walletSdk.generate.get();
            if (error) {
                console.error("Unable to generate a new token", error);
                return;
            }

            // Save the token and return it
            jotaiStore.set(sdkSessionAtom, data);
            return data;
        },
        staleTime: ({ state }) => {
            if (state.data) {
                // If we got a token, keep it in mem for expiration time less 15min
                const stale = state.data.expires - 15 * 60 * 1000;
                if (stale > Date.now()) {
                    return stale;
                }
            }

            // Default to 15min
            return 15 * 60 * 1000;
        },
    });
    return {
        sdkSession: query.data,
        getSdkSession: query.refetch,
        ...query,
    };
}
