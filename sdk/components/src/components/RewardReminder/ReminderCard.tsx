import {
    isMobile,
    type Language,
    type PendingRewardSummary,
    sdkConfigStore,
} from "@frak-labs/core-sdk";
import type { Ref } from "preact";
import { componentDefaults } from "@/i18n/defaults";
import type { RewardCountdown } from "@/rewards/countdown";
import {
    fillReminderText,
    formatFiat,
    formatRewardDate,
    pickFiat,
    resolveRewardCurrency,
} from "@/rewards/format";
import { InstallQr } from "../Ambassador/InstallQr";
import {
    actions,
    breakdown,
    breakdownRow,
    card,
    cardHeader,
    close,
    cta,
    deadline,
    deadlineUrgent,
    description,
    later,
    qr,
    qrCaption,
    title,
    unlock,
} from "./RewardReminder.css";

export const URGENT_FROM_DAYS = 3;

type Copy = (typeof componentDefaults)["en"]["rewardReminder"];

type ReminderCardProps = {
    id: string;
    titleId: string;
    cardRef: Ref<HTMLDivElement>;
    lang: Language;
    pending: PendingRewardSummary;
    countdown: RewardCountdown | undefined;
    installUrl: string | undefined;
    isPreview: boolean;
    texts: { title?: string; description?: string; cta?: string };
    onClose: () => void;
    onClaim: (event: MouseEvent) => void;
    onLater: () => void;
};

function readBrand(): string {
    return (
        sdkConfigStore.getConfig().name ||
        window.FrakSetup?.config?.metadata?.name ||
        window.location.hostname
    );
}

function deadlineTemplate(days: number, copy: Copy): string {
    if (days <= 0) return copy.deadlineToday;
    if (days === 1) return copy.deadlineOneDay;
    return copy.deadlineDays;
}

function parseDate(iso: string | null): Date | undefined {
    const date = iso ? new Date(iso) : undefined;
    return date && !Number.isNaN(date.getTime()) ? date : undefined;
}

function unlockNoteText(
    pending: PendingRewardSummary,
    copy: Copy,
    lang: Language
): string | undefined {
    const date =
        pending.lockedCount > 0 ? parseDate(pending.nextUnlockAt) : undefined;
    if (!date) return undefined;
    const template =
        pending.lockedCount >= pending.count
            ? copy.unlockNoteAll
            : copy.unlockNote;
    return fillReminderText(template, { date: formatRewardDate(date, lang) });
}

type ClaimAnchorProps = Pick<
    ReminderCardProps,
    "installUrl" | "isPreview" | "onClaim"
> & { children: string };

function ClaimAnchor({
    installUrl,
    isPreview,
    onClaim,
    children,
}: ClaimAnchorProps) {
    const inert = !isPreview && !installUrl;
    return (
        <a
            class={cta}
            href={isPreview ? "#" : installUrl}
            target={isPreview ? undefined : "_blank"}
            rel="noopener"
            role={inert ? "link" : undefined}
            tabIndex={inert ? 0 : undefined}
            aria-disabled={inert ? "true" : undefined}
            onClick={onClaim}
        >
            {children}
        </a>
    );
}

/** The expanded half of the reminder: amount breakdown, deadline, claim link and, on desktop, the install QR. */
export function ReminderCard({
    id,
    titleId,
    cardRef,
    lang,
    pending,
    countdown,
    installUrl,
    isPreview,
    texts,
    onClose,
    onClaim,
    onLater,
}: ReminderCardProps) {
    const copy = componentDefaults[lang].rewardReminder;
    const currency = resolveRewardCurrency();
    const days = countdown?.days;
    const values = {
        reward: formatFiat(pending.total, currency),
        days,
        date: countdown ? formatRewardDate(countdown.date, lang) : undefined,
        brand: readBrand(),
    };
    const unlockText = unlockNoteText(pending, copy, lang);
    const showBreakdown =
        pickFiat(pending.cashback, currency) !== 0 &&
        pickFiat(pending.fromFriends, currency) !== 0;
    const urgent = days !== undefined && days <= URGENT_FROM_DAYS;
    return (
        <div
            ref={cardRef}
            id={id}
            class={card}
            role="dialog"
            aria-labelledby={titleId}
            tabIndex={-1}
        >
            <div class={cardHeader}>
                <p id={titleId} class={title}>
                    {fillReminderText(texts.title || copy.title, values)}
                </p>
                <button
                    type="button"
                    class={close}
                    aria-label={copy.closeLabel}
                    onClick={onClose}
                >
                    ×
                </button>
            </div>
            {showBreakdown && (
                <ul class={breakdown}>
                    <li class={breakdownRow}>
                        <span>{copy.cashbackLabel}</span>
                        <span>{formatFiat(pending.cashback, currency)}</span>
                    </li>
                    <li class={breakdownRow}>
                        <span>{copy.fromFriendsLabel}</span>
                        <span>{formatFiat(pending.fromFriends, currency)}</span>
                    </li>
                </ul>
            )}
            <p class={description}>
                {fillReminderText(
                    texts.description || copy.description,
                    values
                )}
            </p>
            {days !== undefined && (
                <p class={urgent ? `${deadline} ${deadlineUrgent}` : deadline}>
                    {fillReminderText(deadlineTemplate(days, copy), values)}
                </p>
            )}
            {unlockText && <p class={unlock}>{unlockText}</p>}
            <div class={actions}>
                <ClaimAnchor
                    installUrl={installUrl}
                    isPreview={isPreview}
                    onClaim={onClaim}
                >
                    {fillReminderText(texts.cta || copy.cta, values)}
                </ClaimAnchor>
                <button type="button" class={later} onClick={onLater}>
                    {copy.later}
                </button>
            </div>
            {!isMobile() && (
                <InstallQr
                    url={installUrl}
                    label={copy.qrLabel}
                    caption={copy.qrCaption}
                    class={qr}
                    captionClass={qrCaption}
                />
            )}
        </div>
    );
}
