import type {
    AttributionDefaults,
    AttributionParams,
    Currency,
    InteractionTypeKey,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import type { Address } from "viem";
import { trackEvent } from "../../common/analytics";
import type { SharingSource } from "../../common/analytics/events";
import { rewardProductsForSelection } from "../../common/hook/rewardProductsForSelection";
import { useCopyToClipboardWithState } from "../../common/hook/useCopyToClipboardWithState";
import { useFormattedEstimatedReward } from "../../common/hook/useFormattedEstimatedReward";
import { buildSharingLink } from "../buildSharingLink";
import type {
    SharingChrome,
    SharingPageProps,
    SharingReward,
    SharingT,
} from "../component/SharingPage/types";
import {
    clearConfirmation,
    getSavedConfirmation,
    saveConfirmation,
} from "../utils/confirmation";
import { useShareLink } from "./useShareLink";

/**
 * What a host does with an outcome, and the only thing that genuinely differs
 * between the three surfaces this page runs on.
 *
 * `share` and `copy` return `true` when the outcome was handed off, so the
 * page does not also act on it locally. A native host has to own both: an
 * Android WebView has no `navigator.share`, and the interaction a share earns
 * must be signed by the SDK keypair this page cannot reach.
 */
export type SharingOutcomes = {
    share?: () => boolean;
    copy?: () => boolean;
    dismiss: () => void;
    shareAgain?: () => void;
    install: () => void;
    confirmationDismiss?: () => void;
    /**
     * A share or copy completed. The listener resolves its pending RPC here;
     * the wallet has nothing to do.
     */
    onConfirmed?: (action: "shared" | "copied") => void;
    /**
     * Record a sharing interaction with the backend, after the analytics
     * event. Fired for a copy as well as a share — both are the user
     * distributing the link. The listener wires its `useTrackSharing` here;
     * the wallet has no equivalent, since a native host's own SDK records the
     * interaction it can sign for.
     */
    recordSharing?: () => void;
};

export type SharingPageControllerInput = {
    merchantId?: string;
    clientId?: string;
    /** Sharer wallet address. Preferred identity when a session exists. */
    wallet?: Address;
    /** Base URL to share, when no product overrides it. */
    link?: string;
    products?: SharingPageProduct[];
    merchant: { name?: string; logoUrl?: string };
    attribution?: AttributionParams | null;
    defaultAttribution?: AttributionDefaults;
    /** Extra inputs the listener's reward query needs; the wallet has none. */
    rewardQuery?: {
        currency?: Currency;
        targetInteraction?: InteractionTypeKey;
        context?: string;
    };
    /**
     * A host's cached headline, painted on the first frame and replaced the
     * moment the real query resolves. Display-only.
     */
    seedReward?: string;
    source: SharingSource;
    installUrl: string | null;
    chrome: SharingChrome;
    /** Open directly on the confirmation screen. */
    confirmed?: boolean;
    /** A warm page reports itself as preloaded instead of viewed. */
    warm?: boolean;
    /** Telemetry only: which SDK build opened this page. */
    sdkVersion?: string;
    /** Whether a share can be handed to a host that has no Web Share API. */
    canHandOffShare?: boolean;
    t: SharingT;
    outcomes: SharingOutcomes;
};

/**
 * Everything the sharing page decides, for every surface that renders it.
 *
 * The wallet route and the listener's sharing page used to implement this
 * twice — product selection, the reward query, the `t` wrapper, the link
 * builder, the confirmation lifecycle, the share mutation and the copy handler
 * — and had already drifted in four places, each a real bug on one surface
 * only. Returns `SharingPageProps` whole, so a consumer is
 * `<SharingPage {...useSharingPageController(...)} />`.
 */
export function useSharingPageController({
    merchantId,
    clientId,
    wallet,
    link,
    products,
    merchant,
    attribution,
    defaultAttribution,
    rewardQuery,
    seedReward,
    source,
    installUrl,
    chrome,
    confirmed = false,
    warm = false,
    sdkVersion,
    canHandOffShare = false,
    t: rawT,
    outcomes,
}: SharingPageControllerInput): SharingPageProps {
    const { copy } = useCopyToClipboardWithState();
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);

    const items = useMemo(() => products ?? [], [products]);

    // Memoised so the query's `select` isn't re-run on every render.
    const rewardProducts = useMemo(
        () => rewardProductsForSelection(items, selectedProductIndex),
        [items, selectedProductIndex]
    );

    const { data: reward, isLoading: isRewardLoading } =
        useFormattedEstimatedReward({
            merchantId,
            products: rewardProducts,
            ...rewardQuery,
        });

    // Paint the host's cached headline until the real one arrives, so the page
    // opens on content instead of a skeleton. The query still runs and takes
    // over the moment it resolves.
    const estimatedReward = reward?.formatted ?? seedReward;
    const appName = merchant.name ?? "";

    // Inject the reward and merchant name into every interpolation, so callers
    // never have to remember to pass them.
    const t = useCallback<SharingT>(
        (key, options) =>
            rawT(key, {
                ...options,
                estimatedReward: estimatedReward ?? "",
                productName: appName,
            }),
        [rawT, estimatedReward, appName]
    );

    // Report the page once, independent of which screen ends up rendering. A
    // warm page has not been seen by anyone yet, so it reports itself as a
    // preload and reports the view when its activation lands — `warm` is in
    // the dep list precisely so that flip fires the second event.
    useEffect(() => {
        trackEvent(warm ? "sharing_page_preloaded" : "sharing_page_viewed", {
            merchant_id: merchantId,
            // Which SDK versions are still in the field, so a change to this
            // page can be weighed against what it would break.
            sdk_version: sdkVersion,
            native: chrome.mode === "none",
        });
    }, [merchantId, sdkVersion, warm, chrome.mode]);

    const [showConfirmation, setShowConfirmation] = useState(
        () =>
            confirmed || (merchantId ? getSavedConfirmation(merchantId) : false)
    );

    // A host used to deliver `confirmed` by loading the page again, which
    // remounted this hook and re-ran the initialiser above. It now delivers it
    // as a fragment on the already-loaded page, and a `useState` initialiser
    // does not run twice — so without this the confirmation screen never
    // appears on exactly the warmed, activated path that is now the fast one.
    useEffect(() => {
        if (confirmed) setShowConfirmation(true);
    }, [confirmed]);

    const selectedProduct = items[selectedProductIndex];

    // Build the final sharing link with Frak context. Prefers the selected
    // product's own link over the caller's default.
    const sharingLink = useMemo(
        () =>
            buildSharingLink({
                clientId,
                merchantId,
                wallet,
                baseUrl: selectedProduct?.link ?? link,
                attribution,
                defaultAttribution,
                productUtmContent: selectedProduct?.utmContent,
            }),
        [
            clientId,
            merchantId,
            wallet,
            link,
            selectedProduct,
            attribution,
            defaultAttribution,
        ]
    );

    const confirm = useCallback(
        (action: "shared" | "copied") => {
            if (merchantId) saveConfirmation(merchantId);
            setShowConfirmation(true);
            outcomes.onConfirmed?.(action);
        },
        [merchantId, outcomes]
    );

    const {
        mutate: triggerSharing,
        isPending: isSharing,
        canShare,
    } = useShareLink(
        sharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
            // Drives the rich preview header (iOS `LinkPresentation` / Android
            // chooser thumbnail). Ignored on web, where `navigator.share` has
            // no standardised preview image field.
            imageUrl: merchant.logoUrl,
        },
        {
            source,
            merchantId,
            onShared: outcomes.recordSharing,
            onSuccess: (result) => {
                if (!result) return;
                toast.success(t("sharing.btn.shareSuccess"));
                confirm("shared");
            },
        }
    );

    const onShare = useCallback(() => {
        // A host that takes the share does the whole thing, including the
        // confirmation, and tells us by reloading or re-activating the page.
        if (outcomes.share?.()) return;
        if (!sharingLink) return;
        triggerSharing();
    }, [outcomes, sharingLink, triggerSharing]);

    const onCopy = useCallback(() => {
        const handedOff = outcomes.copy?.() ?? false;
        if (!sharingLink) return;
        if (!handedOff) copy(sharingLink);

        // Fired even when the copy was handed off, and that double-count is
        // deliberate: this is an OpenPanel event feeding our own funnel
        // analytics, while the host's SDK separately records an interaction
        // that can earn a reward. They measure different things and neither
        // substitutes for the other — do not de-duplicate them.
        trackEvent("sharing_link_copied", {
            source,
            merchant_id: merchantId,
            link: sharingLink,
        });
        outcomes.recordSharing?.();
        toast.success(t("sharing.btn.copySuccess"));
        confirm("copied");
    }, [outcomes, sharingLink, copy, source, merchantId, t, confirm]);

    const onShareAgain = useCallback(() => {
        // Clear first either way: a host may re-present this same URL, and a
        // stale flag would drop the user straight back on the confirmation
        // screen they just left.
        clearConfirmation();
        setShowConfirmation(false);
        outcomes.shareAgain?.();
    }, [outcomes]);

    const rewardView: SharingReward = useMemo(() => {
        // A seeded headline is content, so the skeleton is skipped even while
        // the real query is still in flight.
        if (isRewardLoading && !seedReward) return { status: "loading" };
        return {
            status: "ready",
            payoutType: reward?.payoutType,
            minPurchaseAmount: reward?.minPurchaseAmount,
            isProductScoped: reward?.isProductScoped,
            lockupDurationDays: reward?.lockupDurationDays,
            breakdown: {
                referrer: reward?.referrerReward,
                referee: reward?.refereeReward,
                minPurchaseValue: reward?.minPurchaseValue,
            },
            parts: reward?.parts,
        };
    }, [isRewardLoading, seedReward, reward]);

    return {
        merchant: { name: appName, logoUrl: merchant.logoUrl },
        view: showConfirmation ? "confirmation" : "share",
        chrome,
        sharingLink,
        installUrl,
        reward: rewardView,
        products:
            items.length > 0
                ? {
                      items,
                      selectedIndex: selectedProductIndex,
                      onSelect: setSelectedProductIndex,
                  }
                : undefined,
        share: { canShare: canShare || canHandOffShare, isSharing },
        actions: {
            onShare,
            onCopy,
            onDismiss: outcomes.dismiss,
            onShareAgain,
            onInstall: outcomes.install,
            onConfirmationDismiss:
                outcomes.confirmationDismiss ?? outcomes.dismiss,
        },
        t,
    };
}
