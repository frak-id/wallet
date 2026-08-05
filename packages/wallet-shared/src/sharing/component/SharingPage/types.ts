import type { EstimatedReward, SharingPageProduct } from "@frak-labs/core-sdk";
import type { RewardAmountParts } from "@frak-labs/core-sdk/rewards";

/**
 * Translation function — each consumer provides its own.
 * Listener: cloned i18n with merchant overrides. Wallet: plain
 * `useTranslation()`.
 */
export type SharingT = (
    key: string,
    options?: Record<string, unknown>
) => string;

/**
 * The merchant this page is sharing for.
 *
 * `name` and `logoUrl` are resolved by the consumer, which knows whether they
 * came from a URL param or the backend merchant config — the component only
 * needs the answer.
 */
export type SharingMerchant = {
    name: string;
    logoUrl?: string;
};

/**
 * The reward headline and everything the copy varies on.
 *
 * A union rather than an `isRewardLoading` flag beside five optional fields:
 * while the query is in flight none of the others are knowable, and the flat
 * shape let a caller pass a `lockupDurationDays` it could not yet have.
 */
export type SharingReward =
    | { status: "loading" }
    | {
          status: "ready";
          /**
           * Payout type of the displayed reward. Drives reward-specific
           * presentation on the credit card: tiered rewards get an "Up to"
           * prefix and a matching tagline variant.
           */
          payoutType?: EstimatedReward["payoutType"];
          /**
           * Minimum purchase amount gating the reward, already formatted with
           * the merchant currency (e.g. `"10 €"`). When set, step 2 mentions
           * the minimum order value required to earn.
           */
          minPurchaseAmount?: string;
          /**
           * Whether the selected campaign carries a `productScope`. When true,
           * step 2 and the credit-card tagline mention "selected products"
           * instead of implying every purchase qualifies.
           */
          isProductScoped?: boolean;
          /**
           * Whole-day lockup applied before a reward settles. When set, step 3
           * adds a line stating when earnings become available.
           */
          lockupDurationDays?: number;
          /**
           * Raw per-audience reward details used to render the tier/percentage
           * breakdown inside the "How is my reward calculated?" FAQ answer.
           * When the rewards are fixed (or absent), no breakdown is shown.
           */
          breakdown?: {
              referrer?: EstimatedReward;
              referee?: EstimatedReward;
              minPurchaseValue?: number;
          };
          /**
           * The headline amount pre-split into integer / decimals / unit.
           *
           * Optional on purpose: a host-seeded headline is a bare string with
           * no parts behind it, and it is painted before any query resolves.
           * The credit card falls back to printing the string whole.
           */
          parts?: RewardAmountParts;
      };

/**
 * How much of its own chrome the page draws.
 *
 * A union rather than a `chromeless` boolean beside a `hostCornerRadius`
 * number, because the radius is only meaningful in one of the two modes. As
 * two flat props that invariant was a comment plus a guard duplicated into
 * every component that rendered a container; here `mode: "full"` simply cannot
 * carry a radius.
 *
 * `none` is for a host presenting this page inside its own chrome — a native
 * bottom sheet with its own drag handle and close affordance. Footer CTAs stay
 * either way; the header and the backdrop dismiss do not, since a host that
 * owns the sheet owns dismissal too and an in-page dismiss it cannot observe
 * would empty the sheet while the host keeps it open.
 */
export type SharingChrome =
    | { mode: "full" }
    | {
          mode: "none";
          /**
           * Top corner radius (px) the container draws itself, because the
           * host has deliberately stopped clipping it natively (an Android
           * WebView's GPU functor only carries a rectangular clip, so a
           * round-rect clip around it forced an offscreen/stencil pass every
           * frame).
           */
          cornerRadius?: number;
      };

/** The product picker, absent entirely when there is nothing to pick. */
export type SharingProducts = {
    items: SharingPageProduct[];
    selectedIndex: number;
    onSelect: (index: number) => void;
};

export type SharingShareState = {
    /**
     * Whether a share can be started at all — either the Web Share API is
     * available, or a host is listening for the hand-off. When false the share
     * button is hidden and copy is the only option.
     */
    canShare: boolean;
    /** A share is in progress (pending `navigator.share` or a host round-trip). */
    isSharing: boolean;
};

export type SharingActions = {
    onShare: () => void;
    onCopy: () => void;
    /** "Later" / backdrop / Escape. */
    onDismiss: () => void;
    onShareAgain: () => void;
    /**
     * The install CTA on the confirmation screen. Listener:
     * `emitLifecycleEvent` (iframe→parent redirect). Wallet: navigate to
     * `/install`, or hand off to a native host.
     */
    onInstall: () => void;
    onConfirmationDismiss: () => void;
};

export type SharingPageProps = {
    merchant: SharingMerchant;
    /** Which of the two screens to render. */
    view: "share" | "confirmation";
    chrome: SharingChrome;
    /**
     * The computed sharing link (with Frak context encoded). When null,
     * share/copy are disabled.
     */
    sharingLink: string | null;
    /** Install URL for the wallet app, shown on the confirmation screen. */
    installUrl: string | null;
    reward: SharingReward;
    products?: SharingProducts;
    share: SharingShareState;
    actions: SharingActions;
    t: SharingT;
};

/** Whether the host, rather than this page, draws the surrounding chrome. */
export function isChromeless(chrome: SharingChrome): boolean {
    return chrome.mode === "none";
}

/**
 * Inline style rounding the container's top corners, or `undefined`.
 *
 * Lives here so the two screens that render a container cannot disagree about
 * it. `container` already sets `overflowY: "auto"` in both stylesheets, which
 * establishes a clip on both axes per the CSS overflow spec (an axis left at
 * its `visible` default resolves to `auto` once the other axis is
 * non-visible), so no extra `overflow` is needed alongside it.
 */
export function chromeRadiusStyle(chrome: SharingChrome) {
    if (chrome.mode !== "none" || !chrome.cornerRadius) return undefined;
    return {
        borderTopLeftRadius: `${chrome.cornerRadius}px`,
        borderTopRightRadius: `${chrome.cornerRadius}px`,
    };
}
