import { authenticatedWalletApi } from "@frak-labs/wallet-shared";
import { useMutation } from "@tanstack/react-query";
import { useSyncInstagramLink } from "@/module/game/hook/useInstagramLink";

export type MockInstagramLinkInput = { username: string; follows: boolean };

/** Non-prod only: writes the same link row Meta's webhook will, so the game sees it as real. */
export function useMockInstagramLink() {
    const sync = useSyncInstagramLink();

    const link = useMutation({
        mutationFn: async (input: MockInstagramLinkInput) => {
            const { data, error } =
                await authenticatedWalletApi.instagram.mock.put(input);
            if (error) throw error;
            return data.link;
        },
        onSuccess: sync,
    });

    const revoke = useMutation({
        mutationFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.instagram.mock.delete();
            if (error) throw error;
            return data.link;
        },
        onSuccess: sync,
    });

    return { link, revoke };
}
