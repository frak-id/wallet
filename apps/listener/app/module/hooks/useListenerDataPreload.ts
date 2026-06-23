import { useGetSafeSdkSession } from "@frak-labs/wallet-shared/common/hook/useGetSafeSdkSession";

/**
 * Small hook to preload some listener queries (Ring 1).
 *  - SDK Session status: warming the SDK session lets later interaction-track
 *    calls reuse a valid token instead of re-issuing one.
 *
 * Note: This stays a React hook for now since the consumers (Ring 1 UI)
 * already mount React. Step 7 swaps this for a vanilla `prefetchListenerData()`
 * once the queryClient becomes a vanilla singleton.
 */
export function useListenerDataPreload() {
    useGetSafeSdkSession();
}
