import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { siweAuthenticate } from "../../core/actions";
import {
    type AuthenticateActionParamsType,
    type AuthenticateReturnType,
    FrakRpcError,
} from "../../core/types";
import { useNexusClient } from "./useNexusClient";

type MutationOptions = Omit<
    UseMutationOptions<
        Extract<AuthenticateReturnType, { key: "success" }>,
        FrakRpcError,
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

            // Launch the authentication
            const result = await siweAuthenticate(client, params);
            if (result.key !== "success") {
                throw new FrakRpcError(
                    "Error while performing the SIWE authentication"
                );
            }

            // Return our success result
            return result;
        },
    });
}
