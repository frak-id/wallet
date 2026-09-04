import { SharingView } from "@/module/sharing/component/SharingView";
import {
    assertHostClientId,
    isMissingHostClientIdError,
} from "@/module/sharing/guard";
import { sendHostResult } from "@/module/sharing/host/bridge";
import { parseSharingSearch } from "@/module/sharing/params/search";
import {
    bootstrapStandalonePage,
    reportBootstrapFailure,
} from "../shared/bootstrap";
import { markHostEmbedded } from "../shared/hostEmbed";
import { searchParamsFromLocation } from "../shared/search";

/**
 * Standalone `/sharing`.
 *
 * Same `SharingView` the SPA route renders, without the wallet shell. Opened
 * as a full-page load by the web SDK, by the iOS/Android SDK web views, and by
 * Shopify's post-purchase card — none of which need the router, the smart
 * account, or any of the wallet's other 12 modules.
 */

// Search params come off the URL rather than from TanStack Router, decoded by
// the very same table the route's `validateSearch` uses, so a param can never
// mean one thing here and another there.
const search = parseSharingSearch(searchParamsFromLocation());

markHostEmbedded(search.embed);

/**
 * The SPA route rejects this launch in `beforeLoad` and reports it from its
 * `errorComponent`; with no router there is no such pair, so the guard runs
 * before the first render and simply stops the boot.
 */
function guardHostClientId(): boolean {
    try {
        assertHostClientId(search);
        return true;
    } catch (error) {
        if (!isMissingHostClientIdError(error)) throw error;
        // Tell the host, so its sheet closes instead of showing an error it
        // cannot read.
        sendHostResult({
            scheme: error.returnScheme,
            action: "error",
            sid: error.sid,
        });
        return false;
    }
}

if (guardHostClientId()) {
    bootstrapStandalonePage(
        <SharingView
            search={search}
            navigation={{
                // No router: both exits are document navigations. `toWallet`
                // lands in the SPA, which is the point — the wallet home is
                // the shell's job, not this page's.
                toInstall: ({ installUrl }) =>
                    window.location.assign(installUrl),
                toWallet: () => window.location.assign("/wallet"),
            }}
        />
    ).catch(reportBootstrapFailure);
}
