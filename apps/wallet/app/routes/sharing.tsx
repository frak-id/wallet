import { IS_TAURI } from "@frak-labs/app-essentials/utils/platform";
import type {
    AttributionParams,
    SharingPageProduct,
} from "@frak-labs/core-sdk";
import {
    authenticatedBackendApi,
    buildInstallUrl,
    buildSharingLink,
    clearConfirmation,
    clientIdStore,
    getSavedConfirmation,
    openExternalUrl,
    rewardProductsForSelection,
    SharingPage,
    saveConfirmation,
    sessionStore,
    sharingKey,
    trackEvent,
    useCopyToClipboardWithState,
    useFormattedEstimatedReward,
    useShareLink,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { useStore } from "zustand";
import { useMerchantResolvedConfig } from "@/module/common/hook/useMerchantResolvedConfig";
import {
    type HostResultAction,
    sendHostResult,
} from "@/module/common/utils/buildHostResultUrl";
import { sanitizeRedirectUrl } from "@/module/common/utils/sanitizeRedirectUrl";
import { sanitizeReturnScheme } from "@/module/common/utils/sanitizeReturnScheme";
import { sanitizeSeededReward } from "@/module/common/utils/sanitizeSeededReward";

/**
 * Build AttributionParams from search params.
 *
 * Accepts either a JSON-encoded `attribution` param (for SDK-driven navigation)
 * or individual `utm_*` / `ref` / `via` params (for direct merchant links).
 * Returns `null` when the merchant explicitly disables attribution via `attribution=null`.
 */
function parseAttributionFromSearch(
    search: Record<string, unknown>
): AttributionParams | null | undefined {
    const raw = search.attribution;
    if (raw === null) return null;
    if (raw && typeof raw === "object") {
        return raw as AttributionParams;
    }

    const pick = (key: string): string | undefined =>
        typeof search[key] === "string" ? (search[key] as string) : undefined;

    const fromIndividual: AttributionParams = {
        utmSource: pick("utm_source"),
        utmMedium: pick("utm_medium"),
        utmCampaign: pick("utm_campaign"),
        utmContent: pick("utm_content"),
        utmTerm: pick("utm_term"),
        via: pick("via"),
        ref: pick("ref"),
    };
    const hasAny = Object.values(fromIndividual).some((v) => v !== undefined);
    return hasAny ? fromIndividual : undefined;
}
type SharingSearch = {
    merchantId?: string;
    clientId?: string;
    link?: string;
    appName?: string;
    logoUrl?: string;
    products?: SharingPageProduct[];
    /** Shopify checkout token — fallback to resolve clientId when the `_frak-client-id` cart attribute is missing */
    checkoutToken?: string;
    /** Redirect URL for post-dismiss navigation (e.g. Shopify storefront) */
    redirectUrl?: string;
    /** Attribution overrides for the outbound sharing URL (UTMs, ref, via). */
    attribution?: AttributionParams | null;
    /**
     * Set by a native host embedding this page in its own sheet. Makes
     * `clientId` mandatory (the host owns the caller identity) and renders
     * the page without its own chrome.
     */
    native?: boolean;
    /**
     * Open directly on the post-share confirmation screen. Under `native`
     * this is how the host signals its own share sheet already completed.
     */
    confirmed?: boolean;
    /**
     * Custom scheme a native host listens on for outcomes, since it has no
     * JS bridge: outcomes navigate to `<scheme>://result?action=…`, which
     * the host intercepts in its own web view.
     */
    returnScheme?: string;
    /**
     * Opaque single-use token minted by the host, echoed back on every
     * outcome so it can drop callbacks not belonging to the active session.
     */
    sid?: string;
    /**
     * Version of the native SDK that opened this page. Read only for
     * telemetry today.
     */
    sdkv?: string;
    /**
     * Top corner radius (CSS px) for the sheet a native host presents this
     * page in. The Android host stopped clipping the WebView natively — its
     * `AwDrawFn` GPU functor only carries a rectangular clip, so a Compose
     * `RoundedCornerShape` around it forced an offscreen/stencil pass on
     * every frame — and now rounds the corners in-page instead. iOS omits
     * this param on purpose: a SwiftUI `.sheet` already clips to the system
     * radius, and a second arc drawn inside would read as a double corner.
     * Ignored unless `native` is also set.
     */
    cornerRadius?: number;
    /**
     * Already-formatted reward headline from a host's local cache, painted
     * on the first frame and replaced once the real query resolves.
     * Display-only: never reaches the sharing link or any identity decision.
     */
    r?: string;
    /**
     * The page is being warmed by a host, not shown to anyone. Suppresses
     * `sharing_page_viewed` — the sharing funnel's denominator, which warming every
     * merchant surface would otherwise inflate with sheets nobody opened — and reports
     * `sharing_page_preloaded` instead. Cleared by the activation fragment at tap.
     */
    preload?: boolean;
};

/**
 * Read a flag param regardless of how the router typed it: the router parses
 * search values as JSON, so `?native=1` arrives as the number `1`, not the
 * string `"1"`.
 */
function readFlag(value: unknown): boolean {
    return value === 1 || value === "1" || value === true || value === "true";
}

/**
 * Same JSON parsing as `readFlag`: a host that mints `sid` from a counter
 * sends digits, which would otherwise arrive as a number and be dropped.
 */
function readString(value: unknown): string | undefined {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return undefined;
}

/**
 * Corner radius (CSS px) sent only by a native host — a plain web visitor
 * passing `?cornerRadius=200` must not be able to reach into this page's
 * geometry, so callers only invoke this once `native` is confirmed. Same
 * JSON-parsed-value handling as `readFlag`/`readString`: `?cornerRadius=28`
 * arrives as the number 28, but a host sending it as a string is accepted
 * too. Floors to an integer and clamps to `0..48` so a bad value cannot ask
 * for more corner than the sheet has room for; `0` and anything unparsable
 * read as "no radius", same as omitting the param.
 */
function readCornerRadius(value: unknown): number | undefined {
    const numeric =
        typeof value === "number"
            ? value
            : typeof value === "string"
              ? Number(value)
              : Number.NaN;
    if (!Number.isFinite(numeric)) return undefined;
    const clamped = Math.min(Math.max(Math.floor(numeric), 0), 48);
    return clamped === 0 ? undefined : clamped;
}

/** The per-tap half of the params, which a host may deliver after load. See [useActivationParams]. */
type ActivationSearch = Partial<
    Pick<
        SharingSearch,
        "link" | "products" | "logoUrl" | "r" | "sid" | "preload" | "confirmed"
    >
>;

/**
 * Read the per-tap params out of a location fragment.
 *
 * Only keys the fragment actually carries are returned. That is load-bearing: the result is
 * spread over the query-string params, so a key set to `undefined` would erase the warmed
 * value underneath it rather than leave it alone — `logoUrl` and `appName` come from the
 * merchant config on the warm URL and most activations have nothing to say about them.
 *
 * Returns null for an empty fragment so callers can tell "no activation" from "an
 * activation that happens to carry nothing".
 */
export function parseActivationHash(hash: string): ActivationSearch | null {
    const raw = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!raw) return null;

    const params = new URLSearchParams(raw);
    const activation: ActivationSearch = {};

    const link = params.get("link");
    if (link !== null) activation.link = link;

    const logoUrl = params.get("logoUrl");
    if (logoUrl !== null) activation.logoUrl = logoUrl;

    const sid = params.get("sid");
    if (sid !== null) activation.sid = sid;

    // Sanitised exactly as the query string sanitises it: `r` is painted on the first frame,
    // before any query resolves, so the fragment must not be a way around that filter.
    //
    // Assigned only if it survives sanitising. Setting the key to `undefined` would erase the
    // warm URL's own headline underneath it, which is the exact failure this function's
    // omit-absent-keys contract exists to prevent.
    const seeded = params.get("r");
    if (seeded !== null) {
        const sanitised = sanitizeSeededReward(seeded);
        if (sanitised !== undefined) activation.r = sanitised;
    }

    // `products` is the one structured param. A host that garbles it should cost us the
    // product list, not the whole activation — the sheet is still usable without it.
    const rawProducts = params.get("products");
    if (rawProducts !== null) {
        try {
            const parsed = JSON.parse(rawProducts);
            if (Array.isArray(parsed)) {
                activation.products = parsed as SharingPageProduct[];
            }
        } catch {
            // leave it unset, so the warm URL's own value (if any) still stands
        }
    }

    if (params.has("confirmed")) {
        activation.confirmed = readFlag(params.get("confirmed"));
    }

    // An activation fragment means a user opened this page, so it clears `preload` by
    // default. Only an explicit value can keep the page warm — otherwise a host that forgot
    // the flag would warm forever and never report a single view.
    activation.preload = params.has("preload")
        ? readFlag(params.get("preload"))
        : false;

    return activation;
}

/**
 * The params a warmed page is still missing, delivered by fragment rather than by loading
 * the page again.
 *
 * A native host warms this page against the real merchant so the bundle, React, i18n and the
 * merchant-keyed queries are all done before the user taps. Everything left is per-tap — the
 * link, the products, the seeded headline, the session token — and putting those in the
 * query string would mean a second document load, which is the ~300ms this exists to avoid.
 * A fragment change is same-document: no request, no remount, no React boot.
 *
 * Each activation replaces the previous one rather than merging into it. The pooled page
 * outlives any one sheet, so a merge would let a stale `products` from the last sheet ride
 * along into the next; hosts send the complete per-tap set every time.
 *
 * Note for hosts: two identical fragments in a row fire no `hashchange`. `sid` is minted per
 * session, so in practice they always differ — but a host reusing one must vary something.
 */
function useActivationParams(enabled: boolean): ActivationSearch | null {
    const [params, setParams] = useState<ActivationSearch | null>(() =>
        enabled && typeof window !== "undefined"
            ? parseActivationHash(window.location.hash)
            : null
    );

    useEffect(() => {
        if (!enabled) return;
        const onHashChange = () =>
            setParams(parseActivationHash(window.location.hash));
        window.addEventListener("hashchange", onHashChange);
        return () => window.removeEventListener("hashchange", onHashChange);
    }, [enabled]);

    return params;
}

export const Route = createFileRoute("/sharing")({
    validateSearch: (search: Record<string, unknown>): SharingSearch => {
        const native = readFlag(search.native);
        return {
            merchantId:
                typeof search.merchantId === "string"
                    ? search.merchantId
                    : undefined,
            clientId:
                typeof search.clientId === "string"
                    ? search.clientId
                    : undefined,
            link: typeof search.link === "string" ? search.link : undefined,
            appName:
                typeof search.appName === "string" ? search.appName : undefined,
            logoUrl:
                typeof search.logoUrl === "string" ? search.logoUrl : undefined,
            products:
                typeof search.products === "object"
                    ? (search.products as SharingPageProduct[])
                    : undefined,
            checkoutToken:
                typeof search.checkoutToken === "string"
                    ? search.checkoutToken
                    : undefined,
            redirectUrl: sanitizeRedirectUrl(search.redirectUrl),
            attribution: parseAttributionFromSearch(search),
            native,
            confirmed: readFlag(search.confirmed),
            returnScheme: sanitizeReturnScheme(search.returnScheme),
            sid: readString(search.sid),
            sdkv: readString(search.sdkv),
            // Only a native host may round this page's corners — a plain
            // web visitor passing `?cornerRadius=…` must change nothing.
            cornerRadius: native
                ? readCornerRadius(search.cornerRadius)
                : undefined,
            r: sanitizeSeededReward(search.r),
            preload: readFlag(search.preload),
        };
    },
    beforeLoad: ({ search }) => {
        // A native host owns the caller identity, so a missing `clientId` is
        // a host integration bug, not a state to render.
        if (!(search.native && !search.clientId)) return;

        // Tell the host, so its sheet closes instead of hanging on a
        // wallet-branded error page it cannot interpret.
        if (
            sendHostResult({
                scheme: search.returnScheme,
                action: "error",
                sid: search.sid,
            })
        ) {
            return;
        }

        throw new Error(
            "sharing: `clientId` is required when `native` is set. The host owns the caller identity; the wallet's own stored id must not stand in for it."
        );
    },
    component: WalletSharingPage,
});

function WalletSharingPage() {
    const search = Route.useSearch();
    // A warmed page is activated by fragment, so the per-tap params can arrive after mount.
    // Reading them here means every consumer below sees one merged view and none of them has
    // to know which half of the URL its value came from.
    const activation = useActivationParams(search.native ?? false);
    const {
        merchantId,
        clientId: paramClientId,
        link,
        appName,
        logoUrl,
        products,
        checkoutToken,
        redirectUrl,
        attribution,
        native,
        confirmed,
        returnScheme,
        sid,
        sdkv,
        // Not part of `ActivationSearch` — a native host sets this once, at
        // load, not per tap — so it always comes from `search` regardless of
        // the merge below.
        cornerRadius,
        r: seededReward,
        preload,
    } = { ...search, ...activation };
    const { t: rawT } = useTranslation();
    const navigate = useNavigate();
    const storeClientId = useStore(clientIdStore, (s) => s.clientId);
    const walletAddress = useStore(sessionStore, (s) => s.session?.address);
    const { copy } = useCopyToClipboardWithState();

    // A native host's sheet clips the WebView to a rectangle now (see
    // `cornerRadius`'s doc above), so the rounding is drawn by this page
    // instead. `defaults.css.ts` sets an opaque `body` background via
    // `globalStyle` — root AGENTS.md forbids adding another `globalStyle`
    // to carve out an exception, so the previous inline value is read and
    // restored here instead, scoped to this route only. `document` always
    // exists when this runs: apps/wallet has SSR disabled and boots through
    // `react-dom/client`'s `createRoot` (see `app/main.tsx`), so this
    // component never renders outside a browser.
    useEffect(() => {
        if (!cornerRadius) return;
        const { documentElement, body } = document;
        const previousHtmlBackground = documentElement.style.backgroundColor;
        const previousBodyBackground = body.style.backgroundColor;
        documentElement.style.backgroundColor = "transparent";
        body.style.backgroundColor = "transparent";
        return () => {
            documentElement.style.backgroundColor = previousHtmlBackground;
            body.style.backgroundColor = previousBodyBackground;
        };
    }, [cornerRadius]);

    // Product selection state — default to first product
    const [selectedProductIndex, setSelectedProductIndex] = useState(0);

    // Memoised so the query's `select` isn't re-run on every render.
    const rewardProducts = useMemo(
        () => rewardProductsForSelection(products, selectedProductIndex),
        [products, selectedProductIndex]
    );

    const { data: reward, isLoading: isRewardLoading } =
        useFormattedEstimatedReward({
            merchantId,
            products: rewardProducts,
        });
    // Paint the host's cached headline until the real one arrives, so the page
    // opens on content instead of a skeleton. The query still runs and takes
    // over the moment it resolves.
    const estimatedReward = reward?.formatted ?? seededReward;

    // Report the page once, independent of whether we end up rendering the confirmation
    // screen. A warmed page has not been seen by anyone yet, so it reports itself as a
    // preload and reports the view when its activation fragment lands — `preload` is in the
    // dep list precisely so the flip fires the second event.
    useEffect(() => {
        trackEvent(preload ? "sharing_page_preloaded" : "sharing_page_viewed", {
            merchant_id: merchantId,
            // Which SDK versions are still in the field, so a change here can
            // be weighed against what it would break.
            sdk_version: sdkv,
            native,
        });
    }, [merchantId, sdkv, native, preload]);

    // Tell the host the page has actually painted, so it can drop its loading skeleton on a
    // fact rather than a timer. Two frames: the first is scheduled before this render is
    // committed, the second cannot run until after it has been painted.
    //
    // Skipped while warming — nothing is on screen for a user to be waiting on, and the
    // host has no sheet up to uncover.
    useEffect(() => {
        if (preload || !returnScheme) return;
        let inner = 0;
        const outer = requestAnimationFrame(() => {
            inner = requestAnimationFrame(() => {
                sendHostResult({ scheme: returnScheme, action: "ready", sid });
            });
        });
        return () => {
            cancelAnimationFrame(outer);
            cancelAnimationFrame(inner);
        };
    }, [preload, returnScheme, sid]);

    // Fetch backend-driven merchant config to source attribution defaults
    const { data: defaultAttribution } = useMerchantResolvedConfig({
        merchantId,
        select: (config) => config?.sdkConfig?.attribution,
    });

    // Wrap t to inject estimatedReward + productName into i18n interpolation
    const t = useCallback(
        (key: string, options?: Record<string, unknown>) =>
            rawT(key, {
                ...options,
                estimatedReward: estimatedReward ?? "",
                productName: appName ?? "",
            }),
        [rawT, estimatedReward, appName]
    );

    // A native host states the identity outright; `clientIdStore` (global,
    // not merchant-keyed) and `checkoutToken` must not substitute for it, or
    // `installUrl`/`ensure` would silently target the wrong identity.
    const mayResolveIdentity = !native;

    const immediateClientId = mayResolveIdentity
        ? (paramClientId ?? storeClientId)
        : paramClientId;

    // Fallback: resolve clientId from the backend via checkout token when not directly provided
    const { data: resolvedClientId } = useQuery({
        queryKey: sharingKey.orderClient(merchantId, checkoutToken),
        queryFn: async () => {
            if (!merchantId || !checkoutToken) return null;
            const { data, error } = await authenticatedBackendApi.user.identity[
                "order-client"
            ].get({
                query: {
                    merchantId,
                    checkoutToken,
                },
            });
            if (error) throw error;
            return data.clientId;
        },
        enabled:
            mayResolveIdentity &&
            !immediateClientId &&
            !!merchantId &&
            !!checkoutToken,
        retry: 5,
        retryDelay: 300,
    });

    const clientId = immediateClientId ?? resolvedClientId ?? undefined;

    // Compute the install URL pointing to the /install route.
    //
    // No `#p=` proof here, unlike the listener's builder: this page's
    // `clientId` arrives from a URL param, the wallet's own store, or a
    // backend lookup by checkout token — never from the SDK keypair that
    // could sign for it. Nothing to sign with, so this arm stays a bare id.
    const installUrl = useMemo(() => {
        if (!(merchantId && clientId)) return null;
        return buildInstallUrl({ merchantId, clientId });
    }, [merchantId, clientId]);

    // Check sessionStorage for a recent confirmation. A host that completed a
    // share in its own sheet says so via the URL, since the in-page buttons
    // that would otherwise set this are hidden.
    const [showConfirmation, setShowConfirmation] = useState(
        () =>
            confirmed || (merchantId ? getSavedConfirmation(merchantId) : false)
    );

    // A native host used to deliver `confirmed=1` by loading the page again, which remounted
    // this component and re-ran the initialiser above. It now delivers it as a fragment on the
    // already-loaded page, and a `useState` initialiser does not run twice — so without this the
    // post-share confirmation screen never appears on exactly the warmed, activated path that is
    // now the fast one.
    useEffect(() => {
        if (confirmed) setShowConfirmation(true);
    }, [confirmed]);

    // Build the final sharing link with Frak context via shared helper.
    // Use the selected product's link if available, otherwise fall back to default.
    const finalSharingLink = useMemo(() => {
        const safeProducts = products ?? [];
        const selectedProduct = safeProducts[selectedProductIndex];
        return buildSharingLink({
            clientId,
            merchantId,
            wallet: walletAddress,
            baseUrl: selectedProduct?.link ?? link,
            attribution,
            defaultAttribution: defaultAttribution ?? undefined,
            productUtmContent: selectedProduct?.utmContent,
        });
    }, [
        clientId,
        merchantId,
        walletAddress,
        link,
        products,
        selectedProductIndex,
        attribution,
        defaultAttribution,
    ]);

    // Share mutation using the shared hook (auto-fires `sharing_link_shared`).
    const {
        mutate: triggerSharing,
        isPending: isSharing,
        canShare,
    } = useShareLink(
        finalSharingLink,
        {
            title: t("sharing.title"),
            text: t("sharing.text"),
            // `logoUrl` comes from the merchant's config and drives the
            // rich preview header (iOS LinkPresentation / Android chooser
            // thumbnail). Falls back gracefully when the merchant has no
            // logo configured.
            imageUrl: logoUrl,
        },
        {
            source: "sharing_page_wallet",
            merchantId,
            onSuccess: (result) => {
                if (!result) return;
                toast.success(t("sharing.btn.shareSuccess"));
                if (merchantId) saveConfirmation(merchantId);
                setShowConfirmation(true);
            },
        }
    );

    // Hand an outcome back to the native host, which intercepts the navigation
    // inside its own web view.
    const returnToHost = useCallback(
        (action: HostResultAction) =>
            sendHostResult({ scheme: returnScheme, action, sid }),
        [returnScheme, sid]
    );

    // `useShareLink` reports `canShare: false` in an Android WebView, where
    // `navigator.share` genuinely does not exist — without this the Share button
    // would be hidden on exactly the platform that needs the hand-off most. The
    // gate is the return scheme rather than `native`: a host that opened this
    // page without one has no way to receive the ask, and a button that silently
    // does nothing is worse than one that is not there.
    const canHandOffShare = !!returnScheme;

    // The SDK owns the share itself, for two reasons this page cannot work
    // around: `navigator.share` does not exist in an Android WebView, and the
    // interaction a share earns has to be signed by the SDK keypair. The host
    // reloads this page with `confirmed=1` once its chooser is up, so there is
    // nothing to set here — unlike `handleCopy`, whose host does not reload.
    const handleShare = () => {
        if (returnToHost("share")) return;
        if (!finalSharingLink) return;
        triggerSharing();
    };

    const handleCopy = () => {
        // Same hand-off as `handleShare`, and for the interaction half of the
        // same reason — a WebView clipboard write would work, but the SDK still
        // has to be the one to record the sharing interaction.
        //
        // Unlike `handleShare` this does NOT return early, and the difference is
        // load-bearing: a host does not reload the page for a copy, precisely so
        // that the toast and confirmation screen below survive. A host that did
        // reload would tear down the document mid-toast and leave the copy with
        // no feedback at all — the sheet stopped showing its own the moment this
        // footer became the page's.
        const handedOff = returnToHost("copy");
        if (!finalSharingLink) return;
        if (!handedOff) copy(finalSharingLink);
        trackEvent("sharing_link_copied", {
            source: "sharing_page_wallet",
            merchant_id: merchantId,
            link: finalSharingLink,
        });
        toast.success(t("sharing.btn.copySuccess"));
        if (merchantId) saveConfirmation(merchantId);
        setShowConfirmation(true);
    };

    const handleDismiss = async () => {
        // A native host owns the outcome: `redirectUrl` is a web-only concern
        // and is not sent in native mode.
        if (returnToHost("dismiss")) return;
        if (redirectUrl) {
            if (IS_TAURI) {
                // In Tauri, open the redirect URL in the external browser
                // and navigate back to the wallet home.
                await openExternalUrl(redirectUrl);
                navigate({ to: "/wallet", replace: true });
                return;
            }
            window.location.assign(redirectUrl);
            return;
        }
        // Navigate back or close — on wallet this just goes to the home page
        navigate({ to: "/wallet", replace: true });
    };

    const handleShareAgain = () => {
        // Clear first either way: the host may re-present this same URL, and a
        // stale flag would drop the user straight back on the confirmation
        // screen they just left.
        clearConfirmation();
        setShowConfirmation(false);
        returnToHost("shareAgain");
    };

    const handleInstall = useCallback(() => {
        // The SDK owns the whole install step: parts of the iOS path (a
        // timed pasteboard entry, the in-app App Store sheet) cannot run in
        // a web view, so hand back control instead of navigating directly.
        if (returnToHost("install")) return;
        if (!installUrl) return;
        navigate({
            to: "/install",
            search: { m: merchantId, a: clientId ?? undefined },
        });
    }, [returnToHost, installUrl, merchantId, clientId, navigate]);

    return (
        <SharingPage
            appName={appName ?? ""}
            logoUrl={logoUrl}
            products={products ?? []}
            selectedProductIndex={selectedProductIndex}
            onProductSelect={setSelectedProductIndex}
            sharingLink={finalSharingLink}
            installUrl={installUrl}
            t={t}
            isSharing={isSharing}
            isRewardLoading={isRewardLoading && !seededReward}
            rewardType={reward?.payoutType}
            minPurchaseAmount={reward?.minPurchaseAmount}
            isProductScoped={reward?.isProductScoped}
            lockupDurationDays={reward?.lockupDurationDays}
            rewardBreakdown={{
                referrer: reward?.referrerReward,
                referee: reward?.refereeReward,
                minPurchaseValue: reward?.minPurchaseValue,
            }}
            canShare={canShare || canHandOffShare}
            chromeless={native}
            hostCornerRadius={cornerRadius}
            showConfirmation={showConfirmation}
            onShare={handleShare}
            onCopy={handleCopy}
            onDismiss={handleDismiss}
            onShareAgain={handleShareAgain}
            onInstall={handleInstall}
            onConfirmationDismiss={handleDismiss}
        />
    );
}
