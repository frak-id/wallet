import type {
    DisplayModalParamsType,
    ModalRpcStepsResultType,
    ModalStepTypes,
} from "@frak-labs/core-sdk";
import { displayModal } from "@frak-labs/core-sdk/actions";
import { ClientNotFound, type FrakRpcError } from "@frak-labs/rpc";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

/** @ignore */
type MutationOptions<T extends ModalStepTypes[]> = Omit<
    UseMutationOptions<
        ModalRpcStepsResultType<T>,
        FrakRpcError,
        DisplayModalParamsType<T>
    >,
    "mutationFn" | "mutationKey"
>;

/** @inline */
interface UseDisplayModalParams<T extends ModalStepTypes[] = ModalStepTypes[]> {
    /**
     * Optional mutation options, see {@link @tanstack/react-query!useMutation | `useMutation()`} for more infos
     */
    mutations?: MutationOptions<T>;
}

/**
 * Hook that return a mutation helping to display a modal to the user
 *
 * It's a {@link @tanstack/react-query!home | `tanstack`} wrapper around the {@link @frak-labs/core-sdk!actions.displayModal | `displayModal()`} action
 *
 * @param args
 *
 * @typeParam T
 * The modal steps types to display (the result will correspond to the steps types asked in params)
 * An array of {@link @frak-labs/core-sdk!index.ModalStepTypes | `ModalStepTypes`}
 * If not provided, it will default to a generic array of `ModalStepTypes`
 *
 * @group hooks
 *
 * @returns
 * The mutation hook wrapping the `displayModal()` action
 * The `mutate` and `mutateAsync` argument is of type {@link @frak-labs/core-sdk!index.DisplayModalParamsType | `DisplayModalParamsType<T>`}, with type params `T` being the modal steps types to display
 * The `data` result is a {@link @frak-labs/core-sdk!index.ModalRpcStepsResultType | `ModalRpcStepsResultType`}
 *
 * @see {@link @frak-labs/core-sdk!actions.displayModal | `displayModal()`} for more info about the underlying action
 * @see {@link @tanstack/react-query!useMutation | `useMutation()`} for more info about the mutation options and response
 */
export function useDisplayModal<T extends ModalStepTypes[] = ModalStepTypes[]>({
    mutations,
}: UseDisplayModalParams<T> = {}) {
    const client = useFrakClient();

    return useMutation({
        ...mutations,
        mutationKey: ["frak-sdk", "display-modal"],
        mutationFn: async (args: DisplayModalParamsType<T>) => {
            if (!client) {
                throw new ClientNotFound();
            }

            // Ask to display the modal
            return displayModal(client, args);
        },
    });
}
