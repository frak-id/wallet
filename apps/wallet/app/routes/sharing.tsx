import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import { SharingView } from "@/module/sharing/component/SharingView";
import {
    assertHostClientId,
    isMissingHostClientIdError,
} from "@/module/sharing/guard";
import { sendHostResult } from "@/module/sharing/host/bridge";
import { parseSharingSearch } from "@/module/sharing/params/search";
import type { SharingSearch } from "@/module/sharing/params/table";

/**
 * In-app `/sharing`, used by Tauri and by any client-side navigation.
 *
 * On the web this route is shadowed by the standalone `/sharing` entrypoint
 * (see `sharing.html` + `app/entry/sharing`), which serves the same
 * `SharingView` without booting the wallet shell. Both surfaces share every
 * decision below; only the param source and the navigations differ.
 */
export const Route = createFileRoute("/sharing")({
    validateSearch: parseSharingSearch,
    beforeLoad: ({ search }: { search: SharingSearch }) => {
        assertHostClientId(search);
    },
    errorComponent: ({ error }) => {
        // Tell the host, so its sheet closes instead of showing an error it cannot read.
        if (isMissingHostClientIdError(error)) {
            sendHostResult({
                scheme: error.returnScheme,
                action: "error",
                sid: error.sid,
            });
            return null;
        }
        throw error;
    },
    component: WalletSharingPage,
});

/**
 * The `/install` search this route hands over. Exported for direct testing:
 * dropping a credential here is silent, and the standalone entrypoint cannot
 * catch it because it navigates by URL instead.
 */
export function toInstallSearch({
    merchantId,
    clientId,
    checkoutToken,
}: {
    merchantId?: string;
    clientId?: string;
    checkoutToken?: string;
}) {
    return {
        m: merchantId,
        a: clientId ?? undefined,
        checkoutToken: checkoutToken ?? undefined,
    };
}

function WalletSharingPage() {
    const search = Route.useSearch();
    const navigate = useNavigate();

    // Memoised: the view feeds this straight into `useSharingPageController`'s
    // `outcomes`, whose callbacks are in turn memoised on it.
    const navigation = useMemo(
        () => ({
            toInstall: (params: {
                merchantId?: string;
                clientId?: string;
                checkoutToken?: string;
            }) =>
                navigate({
                    to: "/install",
                    search: toInstallSearch(params),
                }),
            toWallet: () => navigate({ to: "/wallet", replace: true }),
        }),
        [navigate]
    );

    return <SharingView search={search} navigation={navigation} />;
}
