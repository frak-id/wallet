import type { MyEmailResponse } from "@frak-labs/backend-elysia/api/schemas";
import {
    authenticatedWalletApi,
    authKey,
    selectSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useStore } from "zustand";

/**
 * Read whether the current authenticator has an email attached.
 *
 * Backs the "add my email" call-to-action surfaced on the wallet home card
 * and the profile page: the UI only shows the option when this returns `null`.
 *
 * Disabled until a wallet session is present — the endpoint requires a wallet
 * auth header and the hook is typically rendered inside protected routes that
 * already imply a session, but mounting via Suspense before login should be a
 * no-op rather than a 401.
 */
export function useCurrentEmail() {
    const session = useStore(sessionStore, selectSession);

    return useQuery<MyEmailResponse>({
        queryKey: authKey.myEmail,
        queryFn: async () => {
            const { data, error } =
                await authenticatedWalletApi.auth.email.get();
            if (error) throw error;
            return data;
        },
        enabled: !!session?.token,
        // The email rarely changes — once set, the row/card disappear forever.
        // Keep it fresh long enough to avoid refetching on every screen mount.
        staleTime: 5 * 60 * 1000,
    });
}
