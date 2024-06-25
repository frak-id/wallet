import { useMutation } from "@tanstack/react-query";
import { siweAuthenticate } from "../../core/actions";
import type { AuthenticateActionParamsType } from "../../core/types";
import { useNexusClient } from "./useNexusClient";

/**
 * Trigger a dashboard action to the wallet
 */
export function useSiweAuthenticate() {
    const client = useNexusClient();

    return useMutation({
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
