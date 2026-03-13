import { useMutation, useQueryClient } from "@tanstack/react-query";
import { authenticatedBackendApi } from "@/api/backendClient";

type EditExplorerInput = {
    enabled?: boolean;
    config?: {
        heroImageUrl?: string;
        description?: string;
    };
};

export function useEditExplorer({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "explorer", "edit", merchantId],
        mutationFn: async (input: EditExplorerInput) => {
            const { error } = await authenticatedBackendApi
                .merchant({ merchantId })
                .explorer.put(input);

            if (error) {
                throw new Error("Failed to update explorer settings");
            }

            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId],
            });
        },
    });
}
