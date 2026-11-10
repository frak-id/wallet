import {
    type PendingRewardSummary,
    sdkConfigStore,
    trackEvent,
} from "@frak-labs/core-sdk";
import { getInstallUrl } from "@frak-labs/core-sdk/actions";
import { useSyncExternalStore } from "preact/compat";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "preact/hooks";
import { subscribeSdkConfig } from "@/hooks/sdkConfigSubscription";
import { useClientReady } from "@/hooks/useClientReady";
import {
    useHasInlineReminder,
    useReminderDismissed,
} from "@/hooks/useInlineReminder";
import { useRewardSummary } from "@/hooks/useRewardSummary";
import { getRewardCountdown, type RewardCountdown } from "@/rewards/countdown";
import { getPreviewPending } from "@/rewards/previewSummary";
import { isRewardReminderEnabled } from "@/rewards/reminderConfig";
import { isClaimable } from "@/rewards/rewardSummaryStore";

export type ReminderEvent =
    | "reward_reminder_impression"
    | "reward_reminder_opened"
    | "reward_reminder_claim_clicked"
    | "reward_reminder_dismissed";

type ReminderModel = {
    pending: PendingRewardSummary;
    countdown: RewardCountdown | undefined;
    installUrl: string | undefined;
    track: (event: ReminderEvent) => void;
};

function readResolved(): boolean {
    return sdkConfigStore.isResolved;
}

/**
 * Everything the pill needs to know before it draws: whether it may show, the
 * rewards behind it, the prefetched install link and the analytics funnel.
 * `null` while hidden.
 */
export function useRewardReminder(
    isPreview: boolean,
    placement: string | undefined
): ReminderModel | null {
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const isResolved = useSyncExternalStore(subscribeSdkConfig, readResolved);
    const dismissed = useReminderDismissed();
    const hasInline = useHasInlineReminder();

    const active =
        isClientReady &&
        shouldRender &&
        isResolved &&
        !isHidden &&
        isRewardReminderEnabled();
    const { summary } = useRewardSummary(active && !isPreview);

    const previewPending = useMemo(() => getPreviewPending(), []);
    const claimable = isClaimable(summary) ? summary.pending : null;
    const pending = isPreview ? previewPending : claimable;
    const visible =
        isPreview || (active && !!pending && !dismissed && !hasInline);

    const countdown = useMemo(
        () => getRewardCountdown(pending?.expiresAt ?? null),
        [pending?.expiresAt]
    );
    const [installUrl, setInstallUrl] = useState<string | undefined>(undefined);
    const trackedImpressionRef = useRef(false);
    const daysLeft = countdown?.days;
    const locked = (pending?.lockedCount ?? 0) > 0;

    const track = useCallback(
        (event: ReminderEvent) => {
            if (isPreview) return;
            trackEvent(window.FrakSetup?.client, event, {
                surface: "pill",
                placement,
                days_left: daysLeft,
                locked,
            });
        },
        [isPreview, placement, daysLeft, locked]
    );

    useEffect(() => {
        if (!visible || trackedImpressionRef.current) return;
        trackedImpressionRef.current = true;
        track("reward_reminder_impression");
    }, [visible, track]);

    useEffect(() => {
        if (!visible || isPreview) return;
        let cancelled = false;
        getInstallUrl()
            .then((url) => {
                if (!cancelled) setInstallUrl(url);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [visible, isPreview]);

    if (!visible || !pending) return null;
    return { pending, countdown, installUrl, track };
}
