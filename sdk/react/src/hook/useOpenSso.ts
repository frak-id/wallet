import {
    ClientNotFound,
    type FrakRpcError,
    type OpenSsoParamsType,
} from "@frak-labs/core-sdk";
import { openSso } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

type MutationOptions = Omit<
    UseMutationOptions<void, FrakRpcError, OpenSsoParamsType>,
    "mutationFn" | "mutationKey"
>;

interface UseSendInteractionParams {
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to open the SSO page
 *
 * @group hooks
 *
 * @see {@link @frak-labs/core-sdk!actions.openSso | `openSso()`} for more info about the underlying action
 * @see [Tanstack Query - Mutation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation) for more info about the mutation options and response
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
