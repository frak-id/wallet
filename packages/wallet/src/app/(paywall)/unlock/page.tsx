"use client";

import { PaywallUnlock } from "@/module/paywall/component/Unlock";
import { usePaywall } from "@/module/paywall/provider";
import { useRouter } from "next/navigation";
import { useEffect } from "react";

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

    return <PaywallUnlock context={context} />;
}
