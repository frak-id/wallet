import {
    ClientNotFound,
    type FrakRpcError,
    type TrackSsoReturnType,
} from "@frak-labs/core-sdk";
import { trackSso } from "@frak-labs/core-sdk/actions";
import { useEffect, useState } from "react";
import type { Hex } from "viem";
import { useFrakClient } from "./useFrakClient";

/** @inline */
interface UseTrackSsoParams {
    /**
     * The consume key for tracking
     */
    consumeKey?: Hex;
    /**
     * The tracking ID returned from openSso
     */
    trackingId?: Hex;
}

/**
 * Hook that tracks an SSO session using consumeKey and trackingId
 *
 * @param params - The tracking parameters
 *
 * @group hooks
 *
 * @returns
 * The current SSO wallet status
 *
 * @example
 * ```tsx
 * const { mutateAsync: openSso } = useOpenSso();
 * const [ssoParams, setSsoParams] = useState<{consumeKey: Hex, trackingId: Hex}>();
 *
 * // Open SSO with consumeKey
 * const handleSso = async () => {
 *   const consumeKey = "0x...";
 *   const result = await openSso({
 *     directExit: true,
 *     consumeKey,
 *     metadata: { logoUrl: "..." }
 *   });
 *   setSsoParams({ consumeKey, trackingId: result.trackingId });
 * };
 *
 * // Track the SSO status
 * const { status } = useTrackSso({
 *   consumeKey: ssoParams?.consumeKey,
 *   trackingId: ssoParams?.trackingId
 * });
 *
 * if (status?.key === "connected") {
 *   console.log("User authenticated!");
 * }
 * ```
 */
export function useTrackSso({ consumeKey, trackingId }: UseTrackSsoParams) {
    const client = useFrakClient();
    const [status, setStatus] = useState<TrackSsoReturnType | undefined>();
    const [error, setError] = useState<FrakRpcError | undefined>();
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (!client || !consumeKey || !trackingId) {
            return;
        }

        let isActive = true;
        setIsLoading(true);

        const startTracking = async () => {
            try {
                const result = await trackSso(client, {
                    consumeKey,
                    trackingId,
                });

                if (!isActive) return;

                setStatus(result);
                setIsLoading(false);
            } catch (err) {
                if (!isActive) return;

                const frakError =
                    err instanceof Error
                        ? new ClientNotFound()
                        : (err as FrakRpcError);
                setError(frakError);
                setIsLoading(false);
            }
        };

        startTracking();

        return () => {
            isActive = false;
        };
    }, [client, consumeKey, trackingId]);

    return { status, error, isLoading };
}
