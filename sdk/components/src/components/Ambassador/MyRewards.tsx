import type { Language, RewardSummary } from "@frak-labs/core-sdk";
import { getEnvironment, isMobile, trackEvent } from "@frak-labs/core-sdk";
import { useEffect, useId, useRef } from "preact/hooks";
import { useInlineReminderRegistration } from "@/hooks/useInlineReminder";
import { useRewardSummary } from "@/hooks/useRewardSummary";
import { componentDefaults } from "@/i18n/defaults";
import { getRewardCountdown, type RewardCountdown } from "@/rewards/countdown";
import {
    fillReminderText,
    formatFiat,
    formatRewardDate,
    pickFiat,
    resolveRewardCurrency,
} from "@/rewards/format";
import {
    type ClaimableRewardSummary,
    isClaimable,
    markClaimStarted,
} from "@/rewards/rewardSummaryStore";
import {
    myRewards,
    myRewardsActions,
    myRewardsAmount,
    myRewardsBreakdown,
    myRewardsCountdown,
    myRewardsCta,
    myRewardsEyebrow,
    myRewardsFooter,
    myRewardsHeading,
    myRewardsNote,
    myRewardsQr,
    myRewardsQrCaption,
    myRewardsRow,
    myRewardsRowValue,
    myRewardsSecondaryCta,
} from "./Ambassador.css";
import { Figure } from "./Figure";
import { InstallQr } from "./InstallQr";
import type { AmbassadorProps } from "./types";

export type MyRewardsOverrides = Pick<
    AmbassadorProps,
    | "myRewardsEyebrow"
    | "myRewardsLinkedHeading"
    | "myRewardsClaimCtaLabel"
    | "myRewardsShareCtaLabel"
    | "myRewardsWalletCtaLabel"
    | "myRewardsShareAgainCtaLabel"
>;

export type MyRewardsView = "claim" | "earned";

type AmbassadorCopy = (typeof componentDefaults)["en"]["ambassador"];

/** Unlinked visitors with something waiting claim it; linked ones see what this merchant paid or owes. */
export function resolveMyRewardsView(
    summary: RewardSummary | null
): MyRewardsView | null {
    if (!summary) return null;
    if (isClaimable(summary)) return "claim";
    if (!summary.linked) return null;
    const hasEarned =
        !!summary.earned &&
        pickFiat(summary.earned.total, resolveRewardCurrency()) > 0;
    const hasPending = !!summary.pending && summary.pending.count > 0;
    return hasEarned || hasPending ? "earned" : null;
}

type SectionProps = {
    lang: Language;
    brand: string;
    overrides: MyRewardsOverrides;
    isClientReady: boolean;
    onShare: () => void;
};

function formatDate(iso: string | null, lang: Language): string | undefined {
    if (!iso || Number.isNaN(Date.parse(iso))) return undefined;
    return formatRewardDate(new Date(iso), lang);
}

function countdownText(
    copy: AmbassadorCopy,
    countdown: RewardCountdown | undefined,
    lang: Language
): string | undefined {
    if (!countdown) return undefined;
    let template = copy.myRewardsCountdown;
    if (countdown.days === 0) template = copy.myRewardsCountdownToday;
    else if (countdown.days === 1) template = copy.myRewardsCountdownOneDay;
    return fillReminderText(template, {
        days: countdown.days,
        date: formatRewardDate(countdown.date, lang),
    });
}

type ClaimRewardsProps = SectionProps & {
    summary: ClaimableRewardSummary;
    installUrl: string | undefined;
    footer: string;
    qrLabel: string;
    qrCaption: string;
};

export function ClaimRewards({
    summary,
    lang,
    brand,
    overrides,
    installUrl,
    isClientReady,
    onShare,
    footer,
    qrLabel,
    qrCaption,
    isDesktop,
}: ClaimRewardsProps & { isDesktop: boolean }) {
    const { pending } = summary;
    const copy = componentDefaults[lang].ambassador;
    const currency = resolveRewardCurrency();
    const total = formatFiat(pending.total, currency);
    const countdown = getRewardCountdown(pending.expiresAt);
    const locked = pending.lockedCount > 0;
    const unlockDate = locked
        ? formatDate(pending.nextUnlockAt, lang)
        : undefined;
    const reminder = {
        surface: "ambassador" as const,
        days_left: countdown?.days,
        locked,
    };
    const allLocked = pending.lockedCount >= pending.count;
    const impressionTracked = useRef(false);
    const eyebrowId = useId();
    // An anchor without href has no link role: keep it focusable until the link lands.
    const inert = installUrl === undefined;

    useInlineReminderRegistration(true);
    useEffect(() => {
        if (impressionTracked.current) return;
        impressionTracked.current = true;
        trackEvent(
            window.FrakSetup?.client,
            "reward_reminder_impression",
            reminder
        );
    }, [reminder]);

    const rows = [
        [copy.myRewardsCashbackLabel, pending.cashback],
        [copy.myRewardsFriendsLabel, pending.fromFriends],
    ] as const;
    const countdownLine = countdownText(copy, countdown, lang);

    return (
        <section
            aria-labelledby={eyebrowId}
            class={`${myRewards} frak-ambassador__my-rewards frak-ambassador__my-rewards--claim`}
        >
            <p
                id={eyebrowId}
                class={`${myRewardsEyebrow} frak-ambassador__my-rewards-eyebrow`}
            >
                {overrides.myRewardsEyebrow ?? copy.myRewardsEyebrow}
            </p>
            <p class={`${myRewardsAmount} frak-ambassador__my-rewards-amount`}>
                <Figure amount={total} />
            </p>
            <div
                class={`${myRewardsBreakdown} frak-ambassador__my-rewards-breakdown`}
            >
                {rows
                    .filter(([, amounts]) => pickFiat(amounts, currency) > 0)
                    .map(([label, amounts]) => (
                        <p
                            key={label}
                            class={`${myRewardsRow} frak-ambassador__my-rewards-row`}
                        >
                            <span>{label}</span>
                            <span class={myRewardsRowValue}>
                                {formatFiat(amounts, currency)}
                            </span>
                        </p>
                    ))}
            </div>
            {countdownLine ? (
                <p
                    class={`${myRewardsCountdown} frak-ambassador__my-rewards-countdown`}
                >
                    {countdownLine}
                </p>
            ) : null}
            {unlockDate ? (
                <p
                    class={`${myRewardsNote} frak-ambassador__my-rewards-unlock`}
                >
                    {fillReminderText(
                        allLocked
                            ? copy.myRewardsUnlockNoteAll
                            : copy.myRewardsUnlockNote,
                        { date: unlockDate }
                    )}
                </p>
            ) : null}
            <div
                class={`${myRewardsActions} frak-ambassador__my-rewards-actions`}
            >
                <a
                    class={`${myRewardsCta} frak-ambassador__my-rewards-cta`}
                    href={installUrl}
                    role={inert ? "link" : undefined}
                    tabIndex={inert ? 0 : undefined}
                    aria-disabled={inert ? "true" : undefined}
                    onClick={(event) => {
                        if (inert) {
                            event.preventDefault();
                            return;
                        }
                        markClaimStarted();
                        trackEvent(
                            window.FrakSetup?.client,
                            "reward_reminder_claim_clicked",
                            reminder
                        );
                    }}
                >
                    {fillReminderText(
                        overrides.myRewardsClaimCtaLabel ??
                            copy.myRewardsClaimCta,
                        { reward: total, brand }
                    )}
                </a>
                {isDesktop ? (
                    <InstallQr
                        url={installUrl}
                        label={qrLabel}
                        caption={qrCaption}
                        class={`${myRewardsQr} frak-ambassador__my-rewards-qr`}
                        captionClass={myRewardsQrCaption}
                    />
                ) : null}
            </div>
            <button
                type="button"
                class={`${myRewardsSecondaryCta} frak-ambassador__my-rewards-share`}
                disabled={!isClientReady}
                onClick={onShare}
            >
                {fillReminderText(
                    overrides.myRewardsShareCtaLabel ?? copy.myRewardsShareCta,
                    { brand }
                )}
            </button>
            <p class={`${myRewardsFooter} frak-ambassador__my-rewards-footer`}>
                {footer}
            </p>
        </section>
    );
}

type EarnedRewardsProps = SectionProps & { summary: RewardSummary };

export function EarnedRewards({
    summary,
    lang,
    brand,
    overrides,
    isClientReady,
    onShare,
}: EarnedRewardsProps) {
    const copy = componentDefaults[lang].ambassador;
    const currency = resolveRewardCurrency();
    const { earned, pending } = summary;
    const receivedTotal =
        earned && pickFiat(earned.total, currency) > 0
            ? formatFiat(earned.total, currency)
            : undefined;
    const unlockDate =
        pending && pending.lockedCount > 0
            ? formatDate(pending.nextUnlockAt, lang)
            : undefined;
    const pendingTemplate = unlockDate
        ? copy.myRewardsOnItsWayUnlock
        : copy.myRewardsOnItsWay;

    return (
        <section
            class={`${myRewards} frak-ambassador__my-rewards frak-ambassador__my-rewards--earned`}
        >
            <h2
                class={`${myRewardsHeading} frak-ambassador__my-rewards-heading`}
            >
                {fillReminderText(
                    overrides.myRewardsLinkedHeading ??
                        copy.myRewardsLinkedHeading,
                    { brand }
                )}
            </h2>
            <div
                class={`${myRewardsBreakdown} frak-ambassador__my-rewards-breakdown`}
            >
                {receivedTotal ? (
                    <p
                        class={`${myRewardsCountdown} frak-ambassador__my-rewards-earned`}
                    >
                        {fillReminderText(copy.myRewardsReceived, {
                            reward: receivedTotal,
                        })}
                    </p>
                ) : null}
                {pending && pending.count > 0 ? (
                    <p
                        class={`${myRewardsCountdown} frak-ambassador__my-rewards-pending`}
                    >
                        {fillReminderText(pendingTemplate, {
                            reward: formatFiat(pending.total, currency),
                            date: unlockDate,
                        })}
                    </p>
                ) : null}
            </div>
            <div
                class={`${myRewardsActions} frak-ambassador__my-rewards-actions`}
            >
                <a
                    class={`${myRewardsCta} frak-ambassador__my-rewards-cta`}
                    href={`${getEnvironment().wallet}/wallet`}
                    target="_blank"
                    rel="noopener"
                >
                    {fillReminderText(
                        overrides.myRewardsWalletCtaLabel ??
                            copy.myRewardsWalletCta,
                        { brand }
                    )}
                </a>
                <button
                    type="button"
                    class={`${myRewardsSecondaryCta} frak-ambassador__my-rewards-share`}
                    disabled={!isClientReady}
                    onClick={onShare}
                >
                    {fillReminderText(
                        overrides.myRewardsShareAgainCtaLabel ??
                            copy.myRewardsShareAgainCta,
                        { brand }
                    )}
                </button>
            </div>
        </section>
    );
}

/** The page's reward summary, plus the formatted pending total while it can be claimed. */
export function useMyRewards(isClientReady: boolean) {
    const { summary } = useRewardSummary(isClientReady);
    const claimReward = isClaimable(summary)
        ? formatFiat(summary.pending.total, resolveRewardCurrency())
        : undefined;
    return { summary, claimReward };
}

/** While a reward waits, the store block sells the claim unless the merchant wrote its own heading. */
export function claimStoreHeading(
    defaults: AmbassadorCopy,
    override: string | undefined,
    claimReward: string | undefined,
    brand: string
): string | undefined {
    if (!claimReward || override !== undefined) return undefined;
    return fillReminderText(defaults.storeHeadingClaim, {
        reward: claimReward,
        brand,
    });
}

type MyRewardsSlotProps = Omit<ClaimRewardsProps, "summary"> & {
    placement: "above" | "below";
    summary: RewardSummary | null;
};

/** The claim prompt sits above the hero, the linked recap below it. */
export function MyRewardsSlot({
    placement,
    summary,
    ...props
}: MyRewardsSlotProps) {
    const view = resolveMyRewardsView(summary);
    if (placement === "above" && view === "claim" && isClaimable(summary)) {
        return (
            <ClaimRewards
                {...props}
                summary={summary}
                isDesktop={!isMobile()}
            />
        );
    }
    if (placement === "below" && view === "earned" && summary) {
        return <EarnedRewards {...props} summary={summary} />;
    }
    return null;
}
