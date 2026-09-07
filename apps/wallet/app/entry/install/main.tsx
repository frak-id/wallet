import type { ReactNode } from "react";
import { InstallView } from "@/module/install/component/InstallView";
import { parseInstallSearch } from "@/module/install/params";
import {
    bootstrapStandalonePage,
    reportBootstrapFailure,
} from "../shared/bootstrap";
import { markHostEmbedded } from "../shared/hostEmbed";
import { searchParamsFromLocation } from "../shared/search";
import * as styles from "./processingLayout.css";

/**
 * Standalone `/install`.
 *
 * Same `InstallView` the SPA route renders, without the wallet shell. This is
 * the page the iOS/Android SDKs open in a web view to hand over an install
 * code, and the one a web visitor lands on from the sharing page — neither
 * needs a router, a smart account, or a blockchain client.
 */

const search = parseInstallSearch(searchParamsFromLocation());

markHostEmbedded(search.embed);

/**
 * Stand-in for the SPA's `PageLayout`, which belongs to the wallet shell (safe
 * areas, headers, footers, scroll restoration). The processing screen is a
 * spinner and one line of text, so it needs none of that.
 */
function ProcessingLayout({ children }: { children: ReactNode }) {
    return <div className={styles.processing}>{children}</div>;
}

bootstrapStandalonePage(
    // No EnsureConflictToast here: the ensure only fires from the logged-in
    // processing branch, which replaces the document with `/wallet` within
    // MIN_PROCESSING_MS — a conflict raised by the network round-trip lands
    // after teardown, and the SPA wallet layout already surfaces it there.
    <InstallView
        search={search}
        navigation={{
            // No router: both exits hand over to the SPA, which owns
            // everything past the install handoff.
            toWallet: () => window.location.replace("/wallet"),
            toRegister: () => window.location.replace("/register"),
        }}
        processingLayout={ProcessingLayout}
    />
).catch(reportBootstrapFailure);
