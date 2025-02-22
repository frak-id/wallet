import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { jotaiStore } from "@module/atoms/store";
import { trackEvent as trackUmamiEvent } from "@module/utils/trackEvent";
import { sessionAtom } from "../atoms/session";

export function trackEvent(name: string, params?: Record<string, unknown>) {
    // Get the current session
    const session = jotaiStore.get(sessionAtom);

    // Get the current resolving context
    const currentContext = jotaiStore.get(iframeResolvingContextAtom);

    trackUmamiEvent(name, {
        ...params,
        ...(session?.address && {
            wallet: session.address,
        }),
        ...(currentContext?.walletReferrer && {
            walletReferrer: currentContext.walletReferrer,
        }),
    });
}
