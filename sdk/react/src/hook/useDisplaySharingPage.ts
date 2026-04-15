import type {
    DisplaySharingPageParamsType,
    DisplaySharingPageResultType,
} from "@frak-labs/core-sdk";
import { displaySharingPage } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/frame-connector";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type MutationOptions = Omit<
    UseMutationOptions<
        DisplaySharingPageResultType,
        FrakRpcError,
        DisplaySharingPageParamsType & { placement?: string }
    >,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseDisplaySharingPageParams {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions;
}

/**
 * Hook that return a mutation helping to display a sharing page to the user
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.displaySharingPage | `displaySharingPage()`} action
 *
 * @param args - Optional config object with `mutations` for customizing the underlying {@link @tanstack/react-query!useMutation | `useMutation()`}
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `displaySharingPage()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!index.DisplaySharingPageParamsType | `DisplaySharingPageParamsType`} with optional `placement`
 * The `data` result is a {@link @frak-labs/core-sdk!index.DisplaySharingPageResultType | `DisplaySharingPageResultType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.displaySharingPage | `displaySharingPage()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useDisplaySharingPage({
    mutations,
}: UseDisplaySharingPageParams = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: ["frak-sdk", "display-sharing-page"],
        mutationFn: async ({
            placement,
            ...params
        }: DisplaySharingPageParamsType & { placement?: string }) => {
            if (!client) {
                throw new ClientNotFound();
            }

            return displaySharingPage(client, params, placement);
        },
    });
}
