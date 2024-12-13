import {
    ClientNotFound,
    type FrakRpcError,
    type OpenSsoParamsType,
} from "@frak-labs/core-sdk";
import { openSso } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @inline */
type MutationOptions = Omit<
    UseMutationOptions<void, FrakRpcError, OpenSsoParamsType>,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseSendInteractionParams {
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to open the SSO page
 * @param args
 * @param args.mutations - The mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`}
 *
 * @group hooks
 *
 * @see {@link @frak-labs/core-sdk!actions.openSso | `openSso()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useOpenSso({ mutations }: UseSendInteractionParams = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: ["frak-sdk", "open-sso"],
        mutationFn: async (params: OpenSsoParamsType) => {
            if (!client) {
                throw new ClientNotFound();
            }
            return openSso(client, params);
        },
    });
}
