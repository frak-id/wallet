import {
    ClientNotFound,
    type FrakRpcError,
    type SiweAuthenticateReturnType,
} from "@frak-labs/core-sdk";
import {
    type SiweAuthenticateModalParams,
    siweAuthenticate,
} from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @inline */
type MutationOptions = Omit<
    UseMutationOptions<
        SiweAuthenticateReturnType,
        FrakRpcError,
        SiweAuthenticateModalParams
    >,
    "mutationFn" | "mutationKey"
>;

/** @ignore */
interface UseSiweAuthenticateParams {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to send perform a SIWE authentication
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.sendTransaction | `sendTransaction()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `siweAuthenticate()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!actions.SiweAuthenticateModalParams | `SiweAuthenticateModalParams`}
 * The `data` result is a {@link @frak-labs/core-sdk!index.SiweAuthenticateReturnType | `SiweAuthenticateReturnType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.siweAuthenticate | `siweAuthenticate()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useSiweAuthenticate({
    mutations,
}: UseSiweAuthenticateParams = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: [
            "frak-sdk",
            "siwe-authenticate",
            client?.config.domain ?? "no-domain",
        ],
        mutationFn: async (params: SiweAuthenticateModalParams) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Launch the authentication
            return siweAuthenticate(client, params);
        },
    });
}
