"use client";

import { PaywallUnlock } from "@/module/paywall/component/Unlock";
import { usePaywall } from "@/module/paywall/provider";
import { WalletHomePage } from "@/module/wallet/component/Home";

export default function WalletPage() {
    const { context } = usePaywall();

    // If we got no context, display the wallet home page
    // TODO: Should be the history maybe?
    if (!context) {
        return <WalletHomePage />;
    }

    // Otherwise, display the paywall unlock page
    return <PaywallUnlock context={context} />;
}
