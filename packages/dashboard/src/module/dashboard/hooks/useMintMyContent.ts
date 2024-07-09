import { mintMyContent } from "@/context/content/action/mint";
import { useMutation } from "@tanstack/react-query";

/**
 * Hook to mint the user content
 */
export function useMintMyContent() {
    return useMutation({
        mutationKey: ["mint-my-content"],
        mutationFn: (args: {
            name: string;
            domain: string;
            contentTypes: bigint;
            setupInteractions?: boolean;
        }) => mintMyContent(args),
    });
}
