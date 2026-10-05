import { IS_IOS } from "@frak-labs/app-essentials/utils/platform";
import { getInvoke, recordError } from "@frak-labs/wallet-shared";
import { useCallback, useEffect, useRef } from "react";
import { isSwipeToCloseModal } from "@/module/common/utils/swipeToCloseModal";
import { modalStore } from "@/module/stores/modalStore";

/**
 * Keeps WKWebView's back swipe off while a swipe-to-close overlay is the top
 * modal, and on otherwise. Mount asserts the state, since a reload keeps the
 * webview's setting but not this hook's memory of it.
 */
export function useNativeSwipeBackGate() {
    const topModalId = modalStore((s) => s.modal?.id);
    const desired = useRef(true);
    const confirmed = useRef<boolean | null>(null);

    // Loops because `desired` can move while a call is pending.
    const sync = useCallback(async () => {
        while (desired.current !== confirmed.current) {
            const enabled = desired.current;
            try {
                const invoke = await getInvoke();
                await invoke("set_swipe_back_enabled", { enabled });
                confirmed.current = enabled;
            } catch (error) {
                recordError(error, {
                    context: { stage: "swipe_back_gate", enabled },
                });
                return;
            }
        }
    }, []);

    useEffect(() => {
        if (!IS_IOS) return;
        desired.current = !isSwipeToCloseModal(topModalId);
        void sync();
    }, [topModalId, sync]);

    useEffect(() => {
        if (!IS_IOS) return;
        const onVisibilityChange = () => {
            if (document.visibilityState === "visible") void sync();
        };
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () =>
            document.removeEventListener(
                "visibilitychange",
                onVisibilityChange
            );
    }, [sync]);
}
