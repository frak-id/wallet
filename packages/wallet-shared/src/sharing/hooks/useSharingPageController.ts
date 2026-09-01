import type {
    AttributionDefaults,
    AttributionParams,
    Currency,
    InteractionTypeKey,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
    sharingConfirmationScope,
} from "../utils/confirmation";
import { sanitizeShareImage } from "../utils/sanitizeShareImage";
import { SHARE_BUDGET, truncateForShare } from "../utils/shareBudget";
import { useShareLink } from "./useShareLink";

/** The resolved share payload, after precedence and sanitization: what actually goes out. */
export type SharingResolvedShareData = {
    link: string | null;
    title: string;
    text: string;
    imageUrl?: string;
};

/**
 * What a host does with an outcome. `share` and `copy` return `true` when the
 * outcome was handed off, so the page does not also act on it locally.
 */
export type SharingOutcomes = {
    share?: (data: SharingResolvedShareData) => boolean;
    copy?: () => boolean;
    dismiss: () => void;
    shareAgain?: () => void;
    install: () => void;
    confirmationDismiss?: () => void;
    /** A share or copy completed; the listener resolves its pending RPC here. */
    onConfirmed?: (action: "shared" | "copied") => void;
    /**
     * Record a sharing interaction with the backend; fired for copy as well, and
     * on a hand-off. A host that signs the interaction with its own SDK keypair
     * already records it — such a host must leave this unset or it double-counts.
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
    /** A host's cached headline, painted until the real query resolves. */
    seedReward?: string;
    /** Per-call overrides for the share title/text/image; highest precedence. */
    shareTitle?: string;
    shareText?: string;
    shareImage?: string;
    source: SharingSource;
    installUrl: string | null;
    chrome: SharingChrome;
    /** Open directly on the confirmation screen. */
    confirmed?: boolean;
    /** A warm page reports itself as preloaded instead of viewed. */
    warm?: boolean;
    /** Telemetry only: which SDK build opened this page. */
    sdkVersion?: string;
    /**
     * Whether a native host is listening for the hand-off. It services BOTH share
     * and copy with its own link, so this page having none does not disable them.
     */
    canHandOff?: boolean;
    t: SharingT;
    outcomes: SharingOutcomes;
};

/** Strips control chars (bar tab/newline) and bidi overrides a merchant field could smuggle in. */
const CONTROL_CHARS_EXCEPT_WHITESPACE = /(?![\n\t])\p{Cc}/gu;
const BIDI_OVERRIDES = /[\u202a-\u202e\u2066-\u2069]/g;

/** Shared by title and text; each clips to its own budget afterwards, exactly once. */
function scrubShareCopy(value: string): string {
    return value
        .replace(CONTROL_CHARS_EXCEPT_WHITESPACE, "")
        .replace(BIDI_OVERRIDES, "")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
}

function sanitizeShareText(value: string): string {
    return truncateForShare(scrubShareCopy(value), SHARE_BUDGET.text);
}

function sanitizeShareTitle(value: string): string {
    // Whitespace collapses after the newlines go, so a blank line cannot leave a double space.
    return truncateForShare(
        scrubShareCopy(value).replace(/\s+/g, " ").trim(),
        SHARE_BUDGET.title
    );
}

/** `""` is "no override", not "override with nothing" — never let a blank win a precedence tier. */
function firstNonEmpty(
    ...values: (string | null | undefined)[]
): string | undefined {
    for (const value of values) {
        if (value) return value;
    }
    return undefined;
}

/**
 * Everything the sharing page decides, for every surface that renders it.
 * Returns `SharingPageProps` whole, so a consumer is
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
    shareTitle,
    shareText,
    shareImage,
    source,
    installUrl,
    chrome,
    confirmed = false,
    warm = false,
    sdkVersion,
    canHandOff = false,
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

    // Paint the host's cached headline until the real one arrives.
    const estimatedReward = reward?.formatted ?? seedReward;
    const appName = merchant.name ?? "";

    // Inject the reward and merchant name into every interpolation.
    const t = useCallback<SharingT>(
        (key, options) =>
            rawT(key, {
                ...options,
                estimatedReward: estimatedReward ?? "",
                productName: appName,
            }),
        [rawT, estimatedReward, appName]
    );

    // A warm page reports a preload, then the view when its activation flips
    // `warm` — which is why `warm` is in the dep list.
    useEffect(() => {
        trackEvent(warm ? "sharing_page_preloaded" : "sharing_page_viewed", {
            merchant_id: merchantId,
            sdk_version: sdkVersion,
            native: chrome.mode === "none",
        });
    }, [merchantId, sdkVersion, warm, chrome.mode]);

    const confirmationScope = useMemo(
        () =>
            sharingConfirmationScope({ merchantId, clientId, products: items }),
        [merchantId, clientId, items]
    );

    const [showConfirmation, setShowConfirmation] = useState(() =>
        confirmed ? true : getSavedConfirmation(confirmationScope)
    );

    // A share banked before the sharer was known sits under a scope about to
    // change. Consumed once, so a different share still drops the confirmation.
    const migrateConfirmation = useRef(false);

    // Neither input is settled at mount, and the `useState` initialiser above
    // does not run twice: a host delivers `confirmed` on the already-loaded
    // page, and `clientId` is minted asynchronously. Re-reading rather than
    // latching is what sends a *different* share back to the share screen — the
    // scope changes, storage has nothing for it, false.
    useEffect(() => {
        if (confirmed) {
            setShowConfirmation(true);
            return;
        }
        if (migrateConfirmation.current) {
            migrateConfirmation.current = false;
            saveConfirmation(confirmationScope);
            setShowConfirmation(true);
            return;
        }
        setShowConfirmation(getSavedConfirmation(confirmationScope));
    }, [confirmed, confirmationScope]);

    const selectedProduct = items[selectedProductIndex];

    // Prefers the selected product's own link over the caller's default.
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

    /** Precedence: per-call override > selected product > merchant translation > bundled default. */
    const shareData: SharingResolvedShareData = useMemo(() => {
        const title = firstNonEmpty(
            shareTitle,
            selectedProduct?.title,
            t("sharing.title")
        );
        const text = firstNonEmpty(shareText, t("sharing.text"));
        // Sanitize the precedence winner, not just the override: `logoUrl` is a bare string too.
        const imageUrl = sanitizeShareImage(
            firstNonEmpty(
                shareImage,
                selectedProduct?.imageUrl,
                merchant.logoUrl
            )
        );
        return {
            link: sharingLink,
            title: title ? sanitizeShareTitle(title) : "",
            text: text ? sanitizeShareText(text) : "",
            imageUrl,
        };
    }, [
        shareTitle,
        shareText,
        shareImage,
        selectedProduct,
        merchant.logoUrl,
        sharingLink,
        t,
    ]);

    const confirm = useCallback(
        (action: "shared" | "copied") => {
            // See `migrateConfirmation`.
            if (!clientId) migrateConfirmation.current = true;
            saveConfirmation(confirmationScope);
            setShowConfirmation(true);
            outcomes.onConfirmed?.(action);
        },
        [clientId, confirmationScope, outcomes]
    );

    const {
        mutate: triggerSharing,
        isPending: isSharing,
        canShare,
    } = useShareLink(
        sharingLink,
        {
            title: shareData.title,
            text: shareData.text,
            // Rich preview header on native; ignored on web.
            imageUrl: shareData.imageUrl,
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
        // A host that takes the share also owns the confirmation, and reports no
        // completion back — so this tap is the only share signal we ever get for
        // it. `useShareLink`, which normally emits it, never runs on this path.
        if (outcomes.share?.(shareData)) {
            trackEvent("sharing_link_started", {
                source,
                merchant_id: merchantId,
                handed_off: true,
            });
            outcomes.recordSharing?.();
            return;
        }
        if (!sharingLink) return;
        triggerSharing();
    }, [outcomes, shareData, sharingLink, triggerSharing, source, merchantId]);

    const onCopy = useCallback(() => {
        // Ahead of the hand-off, and unconditionally: `outcomes.copy` reports
        // that a return scheme was present, not that a host answered it, so a
        // shared link opened in an ordinary browser would otherwise toast over
        // an untouched clipboard. A host that does answer writes its own link
        // after this one and wins, which is the outcome it tracked.
        const wroteLocally = sharingLink !== null;
        if (sharingLink) copy(sharingLink);

        const handedOff = outcomes.copy?.() ?? false;
        if (!(handedOff || wroteLocally)) return;

        // Fired even when the copy was handed off: this funnel event and the
        // host SDK's interaction measure different things, do not de-duplicate.
        trackEvent("sharing_link_copied", {
            source,
            merchant_id: merchantId,
            // Reported when this page wrote it, which is observable, rather
            // than gated on `handedOff`, which is not: a host may or may not
            // have replaced it, and either way this is the link we put there.
            link: wroteLocally ? (sharingLink ?? undefined) : undefined,
            handed_off: handedOff,
        });
        outcomes.recordSharing?.();
        toast.success(t("sharing.btn.copySuccess"));
        confirm("copied");
    }, [outcomes, sharingLink, copy, source, merchantId, t, confirm]);

    const onShareAgain = useCallback(() => {
        // A host may re-present this same URL; a stale flag would land the user
        // back on the confirmation screen.
        clearConfirmation();
        migrateConfirmation.current = false;
        setShowConfirmation(false);
        outcomes.shareAgain?.();
    }, [outcomes]);

    const rewardView: SharingReward = useMemo(() => {
        // A seeded headline is content, so skip the skeleton.
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
        share: {
            canShare: canShare || canHandOff,
            isSharing,
            // A host services both CTAs with its own link, so a null
            // `sharingLink` alone must not disable them.
            canAct: sharingLink !== null || canHandOff,
        },
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
