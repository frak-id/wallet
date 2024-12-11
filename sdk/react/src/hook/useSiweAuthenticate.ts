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
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        SiweAuthenticateReturnType,
        FrakRpcError,
        SiweAuthenticateModalParams
    >,
    "mutationFn" | "mutationKey"
>;

interface UseSiweAuthenticateParams {
    mutations?: MutationOptions;
}

/**
 * Trigger a dashboard action to the wallet
 */
export function useSiweAuthenticate({
    mutations,
}: UseSiweAuthenticateParams = {}) {
    const client = useNexusClient();

    return useMutation({
        ...mutations,
        mutationKey: [
            "nexus-sdk",
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
