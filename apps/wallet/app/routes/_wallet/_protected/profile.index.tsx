import {
    activePairingsQueryOptions,
    selectWebauthnSession,
    sessionStore,
} from "@frak-labs/wallet-shared";
import { createFileRoute } from "@tanstack/react-router";
import { ProfilePage } from "@/module/settings/component/ProfilePage";

export const Route = createFileRoute("/_wallet/_protected/profile/")({
    component: ProfileRoute,
    // Warm the active pairings list. The address is resolved outside React with
    // the very selector the hook uses, so the prefetched key matches exactly.
    // `void prefetchQuery` so a failed/offline fetch never blocks or rejects the
    // navigation; `useGetActivePairings` renders its own loading/error state.
    // `useWalletSecurityStatus` is intentionally NOT warmed here: it composes
    // three hooks (email, on-chain recovery via wagmi, backend recovery) and the
    // on-chain part needs the React wagmi config, so it cannot be prefetched
    // from a loader without duplicating that wiring.
    loader: ({ context }) => {
        const address = selectWebauthnSession(sessionStore.getState())?.address;
        if (!address) return;
        void context.queryClient.prefetchQuery(
            activePairingsQueryOptions(address)
        );
    },
});

function ProfileRoute() {
    return <ProfilePage />;
}
