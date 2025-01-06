import {
    ClientNotFound,
    type FrakRpcError,
    type SendTransactionReturnType,
} from "@frak-labs/core-sdk";
import {
    type SendTransactionParams,
    sendTransaction,
} from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type MutationOptions = Omit<
    UseMutationOptions<
        SendTransactionReturnType,
        FrakRpcError,
        SendTransactionParams
    >,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseSendTransactionParams {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to send a transaction
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.sendTransaction | `sendTransaction()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `sendTransaction()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!actions.SendTransactionParams | `SendTransactionParams`}
 * The `data` result is a {@link @frak-labs/core-sdk!index.SendTransactionReturnType | `SendTransactionReturnType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.sendTransaction | `sendTransaction()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useSendTransactionAction({
    mutations,
}: UseSendTransactionParams = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: ["frak-sdk", "send-transaction"],
        mutationFn: async (params: SendTransactionParams) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Send the transaction
            return sendTransaction(client, params);
        },
    });
}
