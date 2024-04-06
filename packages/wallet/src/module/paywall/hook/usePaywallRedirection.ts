import { isPaywallRedirectingAtom } from "@/module/paywall/atoms/paywall";
import { useSetAtom } from "jotai";
import { useRouter } from "next/navigation";
import { useCallback, useTransition } from "react";

/**
 * Small hook used to perform redirection in the paywall context
 */
export function usePaywallRedirection() {
    const router = useRouter();
    const [, startTransition] = useTransition();
    const setIsRedirecting = useSetAtom(isPaywallRedirectingAtom);

    return useCallback(
        ({ redirectUrl }: { redirectUrl: string }) => {
            setIsRedirecting(true);
            startTransition(() => router.replace(redirectUrl));
        },
        [router, setIsRedirecting]
    );
}
