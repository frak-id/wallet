import type {
    TrackArrivalParams,
    TrackArrivalResult,
} from "@frak-labs/core-sdk";
import { trackArrival } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";
import { useFrakConfig } from "./useFrakConfig";

/** @ignore */
type MutationOptions = Omit<
    UseMutationOptions<TrackArrivalResult, FrakRpcError, TrackArrivalParams>,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseTrackArrivalParams {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that returns a mutation for tracking arrival events for referral attribution
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.trackArrival | `trackArrival()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `trackArrival()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!index.TrackArrivalParams | `TrackArrivalParams`}
 * The mutation returns a {@link @frak-labs/core-sdk!index.TrackArrivalResult | `TrackArrivalResult`}
 *
 * @see {@link @frak-labs/core-sdk!actions.trackArrival | `trackArrival()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 *
 * @example
 * ```tsx
 * function TrackingComponent() {
 *     const { mutate: trackArrival, isPending } = useTrackArrival();
 *
 *     useEffect(() => {
 *         // Track arrival when referrer is detected
 *         if (referrerWallet) {
 *             trackArrival({ referrerWallet });
 *         }
 *     }, [referrerWallet, trackArrival]);
 *
 *     return <div>{isPending ? 'Tracking...' : 'Ready'}</div>;
 * }
 * ```
 */
export function useTrackArrival({ mutations }: UseTrackArrivalParams = {}) {
    const client = useFrakClient();
    const config = useFrakConfig();

    return useMutation({
        ...mutations,
        mutationKey: ["frak-sdk", "track-arrival"],
        mutationFn: async (params: TrackArrivalParams) => {
            if (!client) {
                throw new ClientNotFound();
            }

            const merchantId = config?.metadata?.merchantId;
            if (!merchantId) {
                return {
                    success: false,
                    error: "No merchantId in SDK config",
                };
            }

            return trackArrival(client, {
                ...params,
                merchantId,
            });
        },
    });
}
