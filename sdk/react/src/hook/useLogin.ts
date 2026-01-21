import type { LoginReturnType } from "@frak-labs/core-sdk";
import { type LoginModalParams, login } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @inline */
type MutationOptions = Omit<
    UseMutationOptions<LoginReturnType, FrakRpcError, LoginModalParams>,
    "mutationFn" | "mutationKey"
>;

/** @ignore */
interface UseLoginParams {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to send perform a login
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.login | `login()`} action
 *
 * @param args
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `login()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!actions.LoginModalParams | `LoginModalParams`}
 * The `data` result is a {@link @frak-labs/core-sdk!index.LoginReturnType | `LoginReturnType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.login | `login()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useLogin({ mutations }: UseLoginParams = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: [
            "frak-sdk",
            "login",
            client?.config.domain ?? "no-domain",
        ],
        mutationFn: async (params: LoginModalParams) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Launch the login
            return login(client, params);
        },
    });
}
