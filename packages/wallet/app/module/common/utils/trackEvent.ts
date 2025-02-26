import { sessionAtom } from "@/module/common/atoms/session";
import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { jotaiStore } from "@shared/module/atoms/store";
import { trackEvent as trackUmamiEvent } from "@shared/module/utils/trackEvent";

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
