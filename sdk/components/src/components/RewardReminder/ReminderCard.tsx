import {
    isMobile,
    type Language,
    type PendingRewardSummary,
    sdkConfigStore,
} from "@frak-labs/core-sdk";
import type { Ref } from "preact";
import { useId, useState } from "preact/hooks";
import { componentDefaults } from "@/i18n/defaults";
import type { RewardCountdown } from "@/rewards/countdown";
import {
    fillReminderText,
    formatFiat,
    formatRewardDate,
    pickFiat,
    resolveRewardCurrency,
} from "@/rewards/format";
import { QrSvg, useInstallQr } from "../Ambassador/InstallQr";
import { GiftIcon } from "../icons/GiftIcon";
import {
    amount,
    breakdown,
    card,
    cardHeader,
    close,
    cta,
    deadline,
    deadlineUrgent,
    eyebrow,
    eyebrowIcon,
    footer,
    footerQr,
    footerQrExpanded,
    free,
    head,
    later,
    qrButton,
    qrButtonExpanded,
    qrHint,
    qrHintExpanded,
    qrImage,
    qrImageExpanded,
    qrPlaceholder,
    tile,
    tileNumber,
    tileUnit,
    tileUrgent,
    tileWord,
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

const classes = (...names: Array<string | false>) =>
    names.filter(Boolean).join(" ");

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

function breakdownText(
    pending: PendingRewardSummary,
    copy: Copy
): string | undefined {
    const currency = resolveRewardCurrency();
    if (
        pickFiat(pending.cashback, currency) === 0 ||
        pickFiat(pending.fromFriends, currency) === 0
    ) {
        return undefined;
    }
    return [
        fillReminderText(copy.breakdownCashback, {
            reward: formatFiat(pending.cashback, currency),
        }),
        fillReminderText(copy.breakdownFromFriends, {
            reward: formatFiat(pending.fromFriends, currency),
        }),
    ].join(" · ");
}

function DayTile({ days, copy }: { days: number; copy: Copy }) {
    const urgent = days <= URGENT_FROM_DAYS;
    return (
        <p class={classes(tile, urgent && tileUrgent)}>
            {days <= 0 ? (
                <>
                    <span class={tileWord}>{copy.tileLastDay}</span>{" "}
                    <span class={tileUnit}>{copy.tileLastDayUnit}</span>
                </>
            ) : (
                <>
                    <span class={tileNumber}>{days}</span>{" "}
                    <span class={tileUnit}>
                        {days === 1 ? copy.tileOneDay : copy.tileDays}
                    </span>
                </>
            )}
        </p>
    );
}

type FooterProps = {
    copy: Copy;
    installUrl: string | undefined;
    onLater: () => void;
};

/** Desktop gets a small QR that a click enlarges to a scannable size; phones only get Later. */
function CardFooter({ copy, installUrl, onLater }: FooterProps) {
    const desktop = !isMobile();
    const { wide, grid } = useInstallQr(desktop ? installUrl : undefined);
    const [expanded, setExpanded] = useState(false);
    const laterButton = (
        <button type="button" class={later} onClick={onLater}>
            {copy.later}
        </button>
    );
    if (!desktop || !wide || !installUrl) {
        return <div class={footer}>{laterButton}</div>;
    }
    return (
        <div class={classes(footer, footerQr, expanded && footerQrExpanded)}>
            {grid ? (
                <button
                    type="button"
                    class={classes(qrButton, expanded && qrButtonExpanded)}
                    aria-expanded={expanded}
                    onClick={() => setExpanded((open) => !open)}
                >
                    <QrSvg
                        grid={grid}
                        label={copy.qrLabel}
                        class={classes(qrImage, expanded && qrImageExpanded)}
                    />
                </button>
            ) : (
                <span class={qrPlaceholder} aria-hidden="true" />
            )}
            <p class={classes(qrHint, expanded && qrHintExpanded)}>
                {expanded ? copy.qrCaption : copy.qrHint}
            </p>
            {laterButton}
        </div>
    );
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

/** The expanded half of the reminder: amount, days left, claim link and, on desktop, an enlargeable install QR. */
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
    const amountId = useId();
    const copy = componentDefaults[lang].rewardReminder;
    const days = countdown?.days;
    const values = {
        reward: formatFiat(pending.total, resolveRewardCurrency()),
        days,
        date: countdown ? formatRewardDate(countdown.date, lang) : undefined,
        brand: readBrand(),
    };
    const split = breakdownText(pending, copy);
    const deadlineLine = [
        days === undefined
            ? undefined
            : fillReminderText(deadlineTemplate(days, copy), values),
        unlockNoteText(pending, copy, lang),
    ]
        .filter(Boolean)
        .join(" ");
    const urgent = days !== undefined && days <= URGENT_FROM_DAYS;
    return (
        <div
            ref={cardRef}
            id={id}
            class={card}
            role="dialog"
            aria-labelledby={`${titleId} ${amountId}`}
            tabIndex={-1}
        >
            <div class={cardHeader}>
                <p id={titleId} class={eyebrow}>
                    <GiftIcon class={eyebrowIcon} ink="#111827" />
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
            <div class={head}>
                <div>
                    <p id={amountId} class={amount}>
                        {values.reward}
                    </p>
                    {split && <p class={breakdown}>{split}</p>}
                </div>
                {days !== undefined && <DayTile days={days} copy={copy} />}
            </div>
            {deadlineLine && (
                <p class={classes(deadline, urgent && deadlineUrgent)}>
                    {deadlineLine}
                </p>
            )}
            <ClaimAnchor
                installUrl={installUrl}
                isPreview={isPreview}
                onClaim={onClaim}
            >
                {fillReminderText(texts.cta || copy.cta, values)}
            </ClaimAnchor>
            <p class={free}>
                {fillReminderText(
                    texts.description || copy.description,
                    values
                )}
            </p>
            <CardFooter copy={copy} installUrl={installUrl} onLater={onLater} />
        </div>
    );
}
