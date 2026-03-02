import { useGetSafeSdkSession } from "@frak-labs/wallet-shared";

/**
 * Small hook to preload some listener queries
 *  - SDK Session status, if some interaction are being pushed, and a sdk session is available, it will limit the overhead of SDK session renew
 */
export function useListenerDataPreload() {
    /**
     * Preload the current SDK session
     */
    useGetSafeSdkSession();
}
