"use client";

import { EnforceChain } from "@/module/chain/component/EnforceChain";
import { PaywallUnlock } from "@/module/paywall/component/Unlock";
import { usePaywall } from "@/module/paywall/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { arbitrumSepolia } from "viem/chains";

export default function UnlockPage() {
    const router = useRouter();
    const { context, isRedirecting } = usePaywall();

    useEffect(() => {
        if (isRedirecting) return;
        !context && router.push("/wallet");
    }, [context, router.push, isRedirecting]);

    if (!context) {
        return null;
    }

    return (
        <EnforceChain targetChainId={arbitrumSepolia.id} silentSwitch={true}>
            <PaywallUnlock context={context} />
        </EnforceChain>
    );
}
