"use client";

import { EnforceChain } from "@/module/chain/component/EnforceChain";
import { isPaywallRedirectingAtom } from "@/module/paywall/atoms/paywall";
import { paywallContextAtom } from "@/module/paywall/atoms/paywallContext";
import { PaywallUnlock } from "@/module/paywall/component/Unlock";
import { useAtomValue } from "jotai/index";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { arbitrumSepolia } from "viem/chains";

export default function UnlockPage() {
    const router = useRouter();
    const paywallContext = useAtomValue(paywallContextAtom);
    const isRedirecting = useAtomValue(isPaywallRedirectingAtom);

    useEffect(() => {
        if (isRedirecting) return;

        // Redirect to wallet page if no paywall context
        !paywallContext && router.replace("/wallet");
    }, [router.replace, isRedirecting, paywallContext]);

    if (!paywallContext) {
        return null;
    }

    return (
        <EnforceChain targetChainId={arbitrumSepolia.id} silentSwitch={true}>
            <PaywallUnlock context={paywallContext} />
        </EnforceChain>
    );
}
