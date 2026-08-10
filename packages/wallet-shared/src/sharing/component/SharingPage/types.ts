import type { EstimatedReward, SharingPageProduct } from "@frak-labs/core-sdk";
import type { RewardAmountParts } from "@frak-labs/core-sdk/rewards";

/** Translation function — each consumer provides its own. */
export type SharingT = (
    key: string,
    options?: Record<string, unknown>
) => string;

export type SharingMerchant = {
    name: string;
    logoUrl?: string;
};

/** The reward headline and everything the copy varies on. */
export type SharingReward =
    | { status: "loading" }
    | {
          status: "ready";
          payoutType?: EstimatedReward["payoutType"];
          /** Already formatted with the merchant currency (e.g. `"10 €"`). */
          minPurchaseAmount?: string;
          isProductScoped?: boolean;
          lockupDurationDays?: number;
          breakdown?: {
              referrer?: EstimatedReward;
              referee?: EstimatedReward;
              minPurchaseValue?: number;
          };
          /**
           * Headline amount pre-split into integer / decimals / unit. Absent for a
           * host-seeded headline, which is a bare string printed whole.
           */
          parts?: RewardAmountParts;
      };

/**
 * How much of its own chrome the page draws. `none` is for a host presenting this
 * page inside its own chrome: footer CTAs stay, the header and backdrop dismiss do
 * not, since the host owns dismissal.
 */
export type SharingChrome = { mode: "full" } | { mode: "none" };

/** The product picker, absent entirely when there is nothing to pick. */
export type SharingProducts = {
    items: SharingPageProduct[];
    selectedIndex: number;
    onSelect: (index: number) => void;
};

export type SharingShareState = {
    /** Web Share API available, or a host is listening for the hand-off. */
    canShare: boolean;
    isSharing: boolean;
    /**
     * Whether share/copy can be serviced at all: this page built a link, or a
     * host will service the action with its own. Drives the CTAs' disabled state.
     */
    canAct: boolean;
};

export type SharingActions = {
    onShare: () => void;
    onCopy: () => void;
    /** "Later" / backdrop / Escape. */
    onDismiss: () => void;
    onShareAgain: () => void;
    onInstall: () => void;
    onConfirmationDismiss: () => void;
};

export type SharingPageProps = {
    merchant: SharingMerchant;
    /** Which of the two screens to render. */
    view: "share" | "confirmation";
    chrome: SharingChrome;
    /**
     * The link this page built, with the Frak context encoded. Null when it could
     * not build one — which does not by itself disable the CTAs, since a host may
     * still service them; see `share.canAct`.
     */
    sharingLink: string | null;
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
