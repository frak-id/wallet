import { useMutation, useQueryClient } from "@tanstack/react-query";

/**
 * Hook to edit merchant details
 * Note: Currently only name can be edited. Domain is immutable.
 */
export function useEditMerchant({ merchantId }: { merchantId: string }) {
    const queryClient = useQueryClient();

    return useMutation({
        mutationKey: ["merchant", "edit", merchantId],
        mutationFn: async ({ name }: { name: string }) => {
            // TODO: Add PATCH endpoint to backend for merchant updates
            // For now, just invalidate to refresh data
            console.log("Edit merchant:", merchantId, name);
            return { success: true };
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["merchant", merchantId],
            });
        },
    });
}
