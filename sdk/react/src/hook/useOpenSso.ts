import type { OpenSsoParamsType, OpenSsoReturnType } from "@frak-labs/core-sdk";
import { openSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type MutationOptions = Omit<
    UseMutationOptions<OpenSsoReturnType, FrakRpcError, OpenSsoParamsType>,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseOpenSsoParams {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to open the SSO page
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.openSso | `openSso()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `openSso()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!index.OpenSsoParamsType | `OpenSsoParamsType`}
 * The mutation doesn't output any value
 *
 * @see {@link @frak-labs/core-sdk!actions.openSso | `openSso()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useOpenSso({ mutations }: UseOpenSsoParams = {}) {
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
