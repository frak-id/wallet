import { sessionAtom } from "@/module/common/atoms/session";
import { openPanel } from "@/module/common/utils/openPanel";
import { iframeResolvingContextAtom } from "@/module/listener/atoms/resolvingContext";
import { jotaiStore } from "@shared/module/atoms/store";
import { trackEvent as trackUmamiEvent } from "@shared/module/utils/trackEvent";

export async function trackEvent(
    name: string,
    params?: Record<string, unknown>
) {
    // Get the current session
    const session = jotaiStore.get(sessionAtom);

    // Get the current resolving context
    const currentContext = jotaiStore.get(iframeResolvingContextAtom);

    // Track the event on umami
    await Promise.allSettled([
        // Track umami events (TODO: To be removed once openPanel is fully integrated)
        trackUmamiEvent(name, {
            ...params,
            ...(session?.address && {
                wallet: session.address,
            }),
            ...(currentContext?.walletReferrer && {
                walletReferrer: currentContext.walletReferrer,
            }),
        }),
        // Track the even with open panel
        await openPanel?.track(name, params),
    ]);
}
