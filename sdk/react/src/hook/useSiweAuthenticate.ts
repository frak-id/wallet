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

/** @inline */
interface UseSiweAuthenticateParams {
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to send perform a SIWE authentication
 * @param args
 * @param args.mutations - The mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`}
 *
 * @group hooks
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
