import { useEffect } from "react";
import { useWalletStatus } from "./useWalletStatus";
import { useWindowLocation } from "./useWindowLocation";

/**
 * Use the current nexus referral
 */
export function useNexusReferral() {
    const { href } = useWindowLocation();
    const { data: walletStatus } = useWalletStatus();

    useEffect(() => {
        if (!href || walletStatus?.key !== "connected") return;

        const url = new URL(href);
        const context = url.searchParams.get("nexusContext");

        if (!context) {
            url.searchParams.set("nexusContext", walletStatus?.wallet);
            window.history.replaceState(null, "", url.toString());
        }
    }, [href, walletStatus]);
}
