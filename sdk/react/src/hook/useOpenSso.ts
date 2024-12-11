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
 * Open the SSO
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
