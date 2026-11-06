import type { Language } from "@frak-labs/core-sdk";
import { trackEvent } from "@frak-labs/core-sdk";
import { getInstallUrl } from "@frak-labs/core-sdk/actions";
import { applyRewardPlaceholder } from "@frak-labs/core-sdk/rewards";
import { useEffect, useRef, useState } from "preact/hooks";
import { useInlineReminderRegistration } from "@/hooks/useInlineReminder";
import { useRewardSummary } from "@/hooks/useRewardSummary";
import { componentDefaults } from "@/i18n/defaults";
import { getRewardCountdown } from "@/rewards/countdown";
import { formatFiat, resolveRewardCurrency } from "@/rewards/format";
import { isClaimable, markClaimStarted } from "@/rewards/rewardSummaryStore";
import { claimLink, cta, ctaSecondary } from "./PostPurchase.css";

const SUMMARY_WAIT_MS = 1500;

type RefereeClaimParams = {
    isPreview: boolean;
    isClientReady: boolean;
    isReferee: boolean;
    rewardText: string | undefined;
    lang: Language;
    propText: string | undefined;
    configText: string | undefined;
};

/**
 * Whether the referee card offers the claim button, and with which text. Unlinked
 * visitors see it; the card waits briefly for the summary so it rarely grows a button late.
 */
export function useRefereeClaim({
    isPreview,
    isClientReady,
    isReferee,
    rewardText,
    lang,
    propText,
    configText,
}: RefereeClaimParams) {
    const enabled = !isPreview && isClientReady && isReferee;
    const { status, summary } = useRewardSummary(enabled);
    const [timedOut, setTimedOut] = useState(false);
    const ready = status === "ready";
    useEffect(() => {
        if (!enabled || ready) return;
        const timer = setTimeout(() => setTimedOut(true), SUMMARY_WAIT_MS);
        return () => clearTimeout(timer);
    }, [enabled, ready]);
    // Once settled the card stays up through a later refetch, so the button never flickers.
    const settledRef = useRef(false);
    if (status === "ready") settledRef.current = true;

    const claimable = isClaimable(summary) ? summary : null;
    const reward = claimable
        ? formatFiat(claimable.pending.total, resolveRewardCurrency())
        : rewardText;
    const show = isReferee && summary?.linked !== true;
    const defaults = componentDefaults[lang].postPurchase;
    const fallback = reward
        ? defaults.claimCtaText
        : defaults.claimCtaNoRewardText;
    return {
        awaitingSummary:
            !isPreview && isReferee && !settledRef.current && !timedOut,
        show,
        claimable: claimable !== null,
        shareClassName: show
            ? `${cta} ${ctaSecondary} button`
            : `${cta} button`,
        text: applyRewardPlaceholder(
            propText ?? configText ?? fallback,
            reward
        ),
        daysLeft: claimable
            ? getRewardCountdown(claimable.pending.expiresAt)?.days
            : undefined,
        locked: (claimable?.pending.lockedCount ?? 0) > 0,
    };
}

type ClaimButtonProps = {
    claim: ReturnType<typeof useRefereeClaim>;
    token?: string;
    merchantId?: string;
    placement?: string;
    isPreview: boolean;
    isClientReady: boolean;
};

/** Sends a referee with no linked wallet to the install page, carrying the order token. */
export function ClaimButton({ claim, ...props }: ClaimButtonProps) {
    return claim.show ? <ClaimLink claim={claim} {...props} /> : null;
}

function ClaimLink({
    claim: { text, daysLeft, locked, claimable },
    token,
    merchantId,
    placement,
    isPreview,
    isClientReady,
}: ClaimButtonProps) {
    const [installUrl, setInstallUrl] = useState<string>();
    const impressionTracked = useRef(false);
    const reminder = {
        surface: "post_purchase" as const,
        placement,
        days_left: daysLeft,
        locked,
    };

    useInlineReminderRegistration(!isPreview);

    useEffect(() => {
        if (isPreview || !isClientReady) return;
        let cancelled = false;
        getInstallUrl({ merchantId, checkoutToken: token })
            .then((url) => {
                if (!cancelled) setInstallUrl(url);
            })
            .catch((error) => console.error("Frak install link failed", error));
        return () => {
            cancelled = true;
        };
    }, [isPreview, isClientReady, merchantId, token]);

    useEffect(() => {
        if (
            isPreview ||
            !isClientReady ||
            !claimable ||
            impressionTracked.current
        )
            return;
        impressionTracked.current = true;
        trackEvent(
            window.FrakSetup?.client,
            "reward_reminder_impression",
            reminder
        );
    }, [isPreview, isClientReady, claimable, reminder]);

    const handleClick = (event: MouseEvent) => {
        if (isPreview) return;
        if (installUrl === undefined) {
            event.preventDefault();
            return;
        }
        markClaimStarted();
        trackEvent(window.FrakSetup?.client, "post_purchase_clicked", {
            placement,
            variant: "referee",
            action: "claim",
        });
        trackEvent(
            window.FrakSetup?.client,
            "reward_reminder_claim_clicked",
            reminder
        );
    };

    // An anchor without href has no link role: keep it focusable until the link lands.
    const inert = installUrl === undefined;
    return (
        <a
            className={`${cta} ${claimLink} button`}
            href={installUrl}
            role={inert ? "link" : undefined}
            tabIndex={inert ? 0 : undefined}
            aria-disabled={inert ? "true" : undefined}
            onClick={handleClick}
        >
            {text}
        </a>
    );
}
