import {
    type Language,
    type PendingRewardSummary,
    type ResolvedPlacement,
    trackEvent,
} from "@frak-labs/core-sdk";
import { getInstallUrl } from "@frak-labs/core-sdk/actions";
import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "preact/hooks";
import { useInlineReminderRegistration } from "@/hooks/useInlineReminder";
import { useLang } from "@/hooks/useLang";
import { componentDefaults } from "@/i18n/defaults";
import { getRewardCountdown } from "@/rewards/countdown";
import { getCountdownLabel } from "@/rewards/countdownLabel";
import { dismissReminder } from "@/rewards/dismissal";
import {
    fillReminderText,
    formatFiat,
    formatRewardDate,
    resolveRewardCurrency,
} from "@/rewards/format";
import { markClaimStarted } from "@/rewards/rewardSummaryStore";
import { GiftIcon } from "../icons/GiftIcon";
import {
    frakLogo,
    iconSvg,
    pendingBody,
    pendingClose,
    pendingCta,
    referral,
    referralBody,
    referralDescription,
    referralIconWrapper,
    referralImage,
    referralTitle,
} from "./Banner.css";

type ReminderEvent =
    | "reward_reminder_impression"
    | "reward_reminder_claim_clicked"
    | "reward_reminder_dismissed";

type PendingBannerProps = {
    pending: PendingRewardSummary;
    isPreview: boolean;
    isClientReady: boolean;
    placementId?: string;
    classname: string;
    imageUrl?: string;
    config?: NonNullable<ResolvedPlacement["components"]>["banner"];
    overrides: { title?: string; description?: string; cta?: string };
};

function pickDate(date: Date | undefined, lang: Language): string | undefined {
    return date ? formatRewardDate(date, lang) : undefined;
}

/** Banner for a visitor with unclaimed rewards and no Frak wallet: amount, days left, link to the wallet install page. */
export function PendingBanner({
    pending,
    isPreview,
    isClientReady,
    placementId,
    classname,
    imageUrl,
    config,
    overrides,
}: PendingBannerProps) {
    const lang = useLang();
    const [installUrl, setInstallUrl] = useState<string | undefined>(undefined);
    const trackedImpressionRef = useRef(false);

    const countdown = useMemo(
        () => getRewardCountdown(pending.expiresAt),
        [pending.expiresAt]
    );
    const daysLeft = countdown?.days;
    const locked = pending.lockedCount > 0;

    useInlineReminderRegistration(!isPreview);

    const track = useCallback(
        (event: ReminderEvent) => {
            if (isPreview) return;
            trackEvent(window.FrakSetup?.client, event, {
                surface: "banner",
                placement: placementId,
                days_left: daysLeft,
                locked,
            });
        },
        [isPreview, placementId, daysLeft, locked]
    );

    useEffect(() => {
        if (isPreview || !isClientReady) return;
        let cancelled = false;
        getInstallUrl()
            .then((url) => {
                if (!cancelled) setInstallUrl(url);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [isPreview, isClientReady]);

    useEffect(() => {
        if (isPreview || !isClientReady || trackedImpressionRef.current) return;
        trackedImpressionRef.current = true;
        track("reward_reminder_impression");
    }, [isPreview, isClientReady, track]);

    const texts = (() => {
        const defaults = componentDefaults[lang].banner;
        const unlockAt = pending.nextUnlockAt
            ? new Date(pending.nextUnlockAt)
            : undefined;
        const allLocked =
            pending.lockedCount >= pending.count &&
            unlockAt !== undefined &&
            !Number.isNaN(unlockAt.getTime());
        const values = {
            reward: formatFiat(pending.total, resolveRewardCurrency()),
            days: countdown?.days,
            date: pickDate(allLocked ? unlockAt : countdown?.date, lang),
        };
        const defaultDescription = [
            allLocked
                ? defaults.pendingDescriptionLocked
                : defaults.pendingDescription,
            countdown && `${getCountdownLabel(countdown.days, lang)}.`,
        ]
            .filter(Boolean)
            .join(" ");
        const fill = (template: string) => fillReminderText(template, values);

        return {
            title: fill(
                overrides.title ?? config?.pendingTitle ?? defaults.pendingTitle
            ),
            description: fill(
                overrides.description ??
                    config?.pendingDescription ??
                    defaultDescription
            ),
            cta: fill(
                overrides.cta ?? config?.pendingCta ?? defaults.pendingCta
            ),
        };
    })();

    const onClaim = useCallback(
        (event: MouseEvent) => {
            if (isPreview) return;
            if (!installUrl) {
                event.preventDefault();
                return;
            }
            markClaimStarted();
            trackEvent(window.FrakSetup?.client, "banner_resolved", {
                placement: placementId,
                variant: "pending",
                outcome: "clicked",
            });
            track("reward_reminder_claim_clicked");
        },
        [isPreview, installUrl, placementId, track]
    );

    const onDismiss = useCallback(() => {
        if (isPreview) return;
        trackEvent(window.FrakSetup?.client, "banner_resolved", {
            placement: placementId,
            variant: "pending",
            outcome: "dismissed",
        });
        track("reward_reminder_dismissed");
        dismissReminder();
    }, [isPreview, placementId, track]);

    const inert = !isPreview && !installUrl;
    const bannerClass = [
        referral,
        "frak-banner",
        "frak-banner--pending",
        classname,
    ]
        .filter(Boolean)
        .join(" ");

    return (
        <section class={bannerClass} aria-label={texts.title}>
            <div class={`${referralIconWrapper} frak-banner__icon`}>
                {imageUrl ? (
                    <img src={imageUrl} alt="" class={referralImage} />
                ) : (
                    <GiftIcon class={iconSvg} />
                )}
            </div>
            <div class={`${referralBody} ${pendingBody} frak-banner__text`}>
                <p class={`${referralTitle} frak-banner__title`}>
                    {texts.title}
                </p>
                <p class={`${referralDescription} frak-banner__description`}>
                    {texts.description}
                </p>
                <a
                    class={`${pendingCta} frak-banner__cta`}
                    href={isPreview ? "#" : installUrl}
                    target={isPreview ? undefined : "_blank"}
                    rel="noopener"
                    role={inert ? "link" : undefined}
                    tabIndex={inert ? 0 : undefined}
                    aria-disabled={inert ? "true" : undefined}
                    onClick={onClaim}
                >
                    {texts.cta}
                </a>
            </div>
            <button
                type="button"
                class={`${pendingClose} frak-banner__close`}
                aria-label={componentDefaults[lang].banner.dismissLabel}
                onClick={onDismiss}
            >
                ×
            </button>
            <LogoFrakWithName
                class={`${frakLogo} frak-banner__logo`}
                width={42}
                height={24}
            />
        </section>
    );
}
