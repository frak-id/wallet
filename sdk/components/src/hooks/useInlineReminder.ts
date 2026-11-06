import { useSyncExternalStore } from "preact/compat";
import { useEffect } from "preact/hooks";
import {
    isReminderDismissed,
    subscribeReminderDismissal,
} from "@/rewards/dismissal";
import {
    hasInlineReminder,
    registerInlineReminder,
    subscribeInlineReminders,
} from "@/rewards/inlineSurfaces";

/** Call from an inline surface while it shows the claim prompt, so the floating pill steps aside. */
export function useInlineReminderRegistration(active: boolean) {
    useEffect(() => {
        if (!active) return;
        return registerInlineReminder();
    }, [active]);
}

export function useHasInlineReminder(): boolean {
    return useSyncExternalStore(subscribeInlineReminders, hasInlineReminder);
}

export function useReminderDismissed(): boolean {
    return useSyncExternalStore(
        subscribeReminderDismissal,
        isReminderDismissed
    );
}
