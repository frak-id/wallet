"use client";

import { PaywallUnlock } from "@/module/paywall/component/Unlock";
import { usePaywall } from "@/module/paywall/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function UnlockPage() {
    const router = useRouter();
    const { context } = usePaywall();

    // If we don't have something to unlock, redirect to wallet
    useEffect(() => {
        !context && router.push("/wallet");
    }, [context, router.push]);

    if (!context) {
        return null;
    }

    return <PaywallUnlock context={context} />;
}
