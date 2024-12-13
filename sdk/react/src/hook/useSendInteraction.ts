import {
    ClientNotFound,
    type FrakRpcError,
    type SendInteractionParamsType,
    type SendInteractionReturnType,
} from "@frak-labs/core-sdk";
import { sendInteraction } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
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
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to send a user interaction
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.sendInteraction | `sendInteraction()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `sendInteraction()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!index.SendInteractionParamsType | `SendInteractionParamsType`}
 * The `data` result is a {@link @frak-labs/core-sdk!index.SendInteractionReturnType | `SendInteractionReturnType`}
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
