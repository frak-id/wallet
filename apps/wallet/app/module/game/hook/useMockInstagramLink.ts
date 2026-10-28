import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useSyncInstagramStatus } from "@/module/game/hook/useInstagramLink";

export type MockInstagramLinkInput = { username: string; follows: boolean };

/** Non-prod only: writes the same certified link Meta's webhook does, so the game sees it as real. */
export function useMockInstagramLink() {
    const sync = useSyncInstagramStatus();

    const link = useMutation({
        mutationFn: async (input: MockInstagramLinkInput) => {
            const { data, error } =
                await authenticatedWalletApi.instagram.mock.put(input);
            if (error) throw error;
            return data;
        },
        onSuccess: sync,
    });

    const revoke = useMutation({
        mutationFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.instagram.mock.delete();
            if (error) throw error;
            return data;
        },
        onSuccess: sync,
    });

    return { link, revoke };
}
