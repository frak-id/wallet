import type { PrepareSsoParamsType } from "@frak-labs/core-sdk";
import { prepareSso } from "@frak-labs/core-sdk/actions";
import { ClientNotFound } from "@frak-labs/frame-connector";
import { useQuery } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

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
export function usePrepareSso(params: PrepareSsoParamsType) {
    const client = useFrakClient();

    return useQuery({
        queryKey: ["frak-sdk", "prepare-sso", params],
        queryFn: async () => {
            if (!client) {
                throw new ClientNotFound();
            }
            return prepareSso(client, params);
        },
    });
}
