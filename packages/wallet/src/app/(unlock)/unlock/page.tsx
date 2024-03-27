"use client";

import { EnforceChain } from "@/module/chain/component/EnforceChain";
import { PaywallUnlock } from "@/module/paywall/component/Unlock";
import { usePaywall } from "@/module/paywall/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { polygonMumbai } from "viem/chains";

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
        <EnforceChain targetChainId={polygonMumbai.id} silentSwitch={true}>
            <PaywallUnlock context={context} />
        </EnforceChain>
    );
}
