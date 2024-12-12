import {
    ClientNotFound,
    type DisplayModalParamsType,
    type FrakRpcError,
    type ModalRpcStepsResultType,
    type ModalStepTypes,
} from "@frak-labs/core-sdk";
import { displayModal } from "@frak-labs/core-sdk/actions";
import { type UseMutationOptions, useMutation } from "@tanstack/react-query";
import { useFrakClient } from "./useFrakClient";

type MutationOptions<T extends ModalStepTypes[]> = Omit<
    UseMutationOptions<
        ModalRpcStepsResultType<T>,
        FrakRpcError,
        DisplayModalParamsType<T>
    >,
    "mutationFn" | "mutationKey"
>;

interface UseDisplayModalParams<T extends ModalStepTypes[] = ModalStepTypes[]> {
    mutations?: MutationOptions<T>;
}

/**
 * Hook that return a mutation helping to display a modal to the user
 *
 * @see {@link displayModal} for more info about the underlying action
 * @see [Tanstack Query - Mutation](https://tanstack.com/query/latest/docs/framework/react/reference/useMutation) for more info about the mutation options and response
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
