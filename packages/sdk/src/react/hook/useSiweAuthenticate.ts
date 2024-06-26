import {
    type DefaultError,
    type UseMutationOptions,
    useMutation,
} from "@tanstack/react-query";
import { siweAuthenticate } from "../../core/actions";
import type {
    AuthenticateActionParamsType,
    AuthenticateReturnType,
} from "../../core/types";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        AuthenticateReturnType,
        DefaultError,
        AuthenticateActionParamsType
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
        mutationFn: async (params: AuthenticateActionParamsType) => {
            if (!client) {
                throw new Error("No client available");
            }

            // Setup the listener
            return await siweAuthenticate(client, params);
        },
    });
}
