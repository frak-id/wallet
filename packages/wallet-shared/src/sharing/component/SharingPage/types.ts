import type { EstimatedReward, SharingPageProduct } from "@frak-labs/core-sdk";
import type { RewardAmountParts } from "@frak-labs/core-sdk/rewards";
import type { Translate } from "../../../types/i18n/translate";

/**
 * Translation function — each consumer provides its own, injecting the reward
 * and merchant interpolations. Scoped to the two namespaces the listener
 * registers: a `translation` key would compile but render as raw text there,
 * since that bundle is kept out of the listener's module graph.
 */
export type SharingT = Translate<"customized" | "common">;

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
    /** Indexes `items`. Absent when no entry is renderable. */
    selectedIndex: number | undefined;
    onSelect: (index: number) => void;
};

/**
 * A title-less entry carries scope fields for reward selection only: it has
 * nothing to draw, so the picker skips it.
 */
function isRenderableProduct(product: SharingPageProduct): boolean {
    return Boolean(product.title?.trim());
}

/**
 * The entries the picker can draw, each paired with its index in `items`.
 * `selectedIndex` keeps indexing the full array.
 */
export function renderableProducts(
    products: SharingProducts
): { product: SharingPageProduct; index: number }[] {
    return products.items
        .map((product, index) => ({ product, index }))
        .filter(({ product }) => isRenderableProduct(product));
}

/**
 * Index of the first entry the picker can draw, or `undefined` when none can.
 * A selection pointing at a hidden entry would scope the reward and the share
 * link to a product the user cannot see or change.
 */
export function firstRenderableIndex(
    items: SharingPageProduct[]
): number | undefined {
    const index = items.findIndex(isRenderableProduct);
    return index === -1 ? undefined : index;
}

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
