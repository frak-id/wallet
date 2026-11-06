import { useCallback, useEffect, useId, useRef, useState } from "preact/hooks";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useLang } from "@/hooks/useLang";
import { componentDefaults } from "@/i18n/defaults";
import { getCountdownLabel } from "@/rewards/countdownLabel";
import { dismissReminder } from "@/rewards/dismissal";
import {
    fillReminderText,
    formatFiat,
    resolveRewardCurrency,
} from "@/rewards/format";
import { markClaimStarted } from "@/rewards/rewardSummaryStore";
import { buildStyleContent } from "@/styles/sharedCss";
import { GiftIcon } from "../icons/GiftIcon";
import { ReminderCard, URGENT_FROM_DAYS } from "./ReminderCard";
import {
    cssSource,
    dismiss,
    icon,
    pill,
    pillAmount,
    pillCountdown,
    pillRow,
    pillRowUrgent,
    root,
    sideLeft,
    sideRight,
} from "./RewardReminder.css";
import type { RewardReminderProps } from "./types";
import { useRewardReminder } from "./useRewardReminder";

function isSide(value: unknown): value is "left" | "right" {
    return value === "left" || value === "right";
}

/**
 * Floating pill for a visitor with unclaimed rewards and no Frak wallet, expanding into a claim card.
 * Snoozed for the browser session once dismissed.
 *
 * @group components
 */
export function RewardReminder({
    placement,
    classname = "",
    position: positionProp,
    heading: headingProp,
    description: descriptionProp,
    cta: ctaProp,
    preview,
}: RewardReminderProps) {
    const isPreview = !!preview;
    const lang = useLang();
    const config = useGlobalComponents()?.rewardReminder;
    const model = useRewardReminder(isPreview, placement);
    const track = model?.track;
    const claimUrl = model?.installUrl;

    const [expanded, setExpanded] = useState(false);
    const pillRef = useRef<HTMLButtonElement>(null);
    const cardRef = useRef<HTMLDivElement>(null);
    const cardId = useId();
    const titleId = useId();

    useEffect(() => {
        if (expanded) cardRef.current?.focus();
    }, [expanded]);

    const collapse = useCallback(() => {
        setExpanded(false);
        pillRef.current?.focus();
    }, []);

    const onPillClick = useCallback(() => {
        if (expanded) {
            collapse();
            return;
        }
        setExpanded(true);
        track?.("reward_reminder_opened");
    }, [expanded, collapse, track]);

    const onDismiss = useCallback(() => {
        track?.("reward_reminder_dismissed");
        if (!isPreview) dismissReminder();
    }, [track, isPreview]);

    const onClaim = useCallback(
        (event: MouseEvent) => {
            if (isPreview) return;
            if (!claimUrl) {
                event.preventDefault();
                return;
            }
            markClaimStarted();
            track?.("reward_reminder_claim_clicked");
        },
        [isPreview, claimUrl, track]
    );

    const onKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if (event.key === "Escape" && expanded) {
                event.stopPropagation();
                collapse();
            }
        },
        [expanded, collapse]
    );

    if (!model) return null;
    const { pending, countdown, installUrl } = model;

    const copy = componentDefaults[lang].rewardReminder;
    const reward = formatFiat(pending.total, resolveRewardCurrency());
    const days = countdown?.days;
    const countdownLabel =
        days === undefined ? undefined : getCountdownLabel(days, lang);
    const pillLabel = [
        fillReminderText(copy.pillLabel, { reward }),
        countdownLabel,
    ]
        .filter(Boolean)
        .join(", ");
    const side = [
        positionProp,
        config?.position,
        window.FrakSetup?.config?.rewardReminder?.position,
    ].find(isSide);
    const urgent = days !== undefined && days <= URGENT_FROM_DAYS;
    const rootClass = [
        root,
        side === "right" ? sideRight : sideLeft,
        "frak-reward-reminder",
        classname,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <>
            <style>{buildStyleContent(cssSource, config?.css)}</style>
            <div class={rootClass} part="root" onKeyDown={onKeyDown}>
                {expanded && (
                    <ReminderCard
                        id={cardId}
                        titleId={titleId}
                        cardRef={cardRef}
                        lang={lang}
                        pending={pending}
                        countdown={countdown}
                        installUrl={installUrl}
                        isPreview={isPreview}
                        texts={{
                            title: headingProp || config?.title,
                            description: descriptionProp || config?.description,
                            cta: ctaProp || config?.cta,
                        }}
                        onClose={collapse}
                        onClaim={onClaim}
                        onLater={onDismiss}
                    />
                )}
                <div class={urgent ? `${pillRow} ${pillRowUrgent}` : pillRow}>
                    <button
                        ref={pillRef}
                        type="button"
                        class={pill}
                        part="pill"
                        aria-expanded={expanded}
                        aria-controls={expanded ? cardId : undefined}
                        aria-label={pillLabel}
                        onClick={onPillClick}
                    >
                        <GiftIcon class={icon} />
                        <span class={pillAmount}>{reward}</span>
                        {countdownLabel && (
                            <span class={pillCountdown}>{countdownLabel}</span>
                        )}
                    </button>
                    <button
                        type="button"
                        class={dismiss}
                        aria-label={copy.dismissLabel}
                        onClick={onDismiss}
                    >
                        ×
                    </button>
                </div>
            </div>
        </>
    );
}
