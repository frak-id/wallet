import {
    ClientNotFound,
    type FrakRpcError,
    type SendInteractionParamsType,
    type SendInteractionReturnType,
} from "@frak-labs/core-sdk";
import { sendInteraction } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @inline */
type MutationOptions = Omit<
    UseMutationOptions<
        SendInteractionReturnType,
        FrakRpcError,
        SendInteractionParamsType
    >,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseSendInteractionParams {
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to send a user interaction
 * @param args
 * @param args.mutations - The mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`}
 *
 * @group hooks
 *
 * @see {@link @frak-labs/core-sdk!actions.sendInteraction | `sendInteraction()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useSendInteraction({
    mutations,
}: UseSendInteractionParams = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: ["frak-sdk", "send-interaction"],
        mutationFn: async (params: SendInteractionParamsType) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Setup the listener
            return sendInteraction(client, params);
        },
    });
}
