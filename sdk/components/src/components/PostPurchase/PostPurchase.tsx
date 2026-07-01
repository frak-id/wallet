import type {
    Currency,
    EstimatedReward,
    GetMerchantInformationReturnType,
    SharingPageProduct,
    UserReferralStatusType,
} from "@frak-labs/core-sdk";
import { trackEvent } from "@frak-labs/core-sdk";
import {
    getMerchantInformation,
    getUserReferralStatus,
    trackPurchaseStatus,
} from "@frak-labs/core-sdk/actions";
import {
    type RewardAudience,
    selectDisplayCampaign,
} from "@frak-labs/core-sdk/rewards";
import { LogoFrakWithName } from "@frak-labs/design-system/icons";
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import {
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "preact/hooks";
import { openSharingPage } from "@/actions/sharingPage";
import { useClientReady } from "@/hooks/useClientReady";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useLang } from "@/hooks/useLang";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { componentDefaults } from "@/i18n/defaults";
import { cssSource as sharedBaseCss } from "@/styles/sharedBaseCss.css";
import {
    applyRewardPlaceholder,
    formatRewardOrHide,
} from "@/utils/format/formatReward";
import { sanitizeProductList } from "@/utils/sharingPageProducts";
import { GiftIcon } from "../icons/GiftIcon";
import {
    badge,
    card,
    cardLayout,
    cardLeft,
    cardRight,
    cssSource,
    cta,
    customImage,
    frakLogo,
    giftIcon,
    icon,
    imageWrapper,
    message,
} from "./PostPurchase.css";
import type { PostPurchaseProps } from "./types";

/**
 * Resolved context computed locally from referral status + merchant info.
 */
type ResolvedPostPurchaseContext = {
    variant: "referrer" | "referee";
    reward: EstimatedReward | undefined;
    merchantDomain: string | undefined;
};

/**
 * Given referral status and merchant info, compute the display variant
 * and pick the appropriate purchase reward.
 */
function resolvePostPurchaseContext(
    referralStatus: UserReferralStatusType | null,
    merchantInfo: GetMerchantInformationReturnType,
    currency: Currency | undefined
): ResolvedPostPurchaseContext | null {
    const audience: RewardAudience = referralStatus?.isReferred
        ? "referee"
        : "referrer";
    // Shared selector: the best live "purchase" campaign for the viewer's side,
    // time-gated so an expired campaign is never advertised.
    const selected = selectDisplayCampaign(merchantInfo.rewards, {
        targetInteraction: "purchase",
        currency,
        audience,
    });
    if (!selected) return null;

    const { campaign } = selected;
    // A referred user sees the referee side only when the campaign defines one;
    // otherwise fall back to the referrer reward (and the sharer prompt).
    const variant =
        referralStatus?.isReferred && campaign.referee ? "referee" : "referrer";
    const reward = variant === "referee" ? campaign.referee : campaign.referrer;

    return {
        variant,
        reward,
        merchantDomain: merchantInfo.onChainMetadata.domain,
    };
}

/**
 * Post-purchase card component.
 *
 * Renders an inline card on the merchant's thank-you / order-status page
 * that either congratulates a referee or invites a referrer to share.
 *
 * Fetches referral status and merchant information via two independent
 * RPC calls, then computes the display variant locally.
 *
 * @group components
 *
 * @example
 * Minimal — just show the card:
 * ```html
 * <frak-post-purchase></frak-post-purchase>
 * ```
 *
 * @example
 * With purchase tracking fallback and custom sharing URL:
 * ```html
 * <frak-post-purchase
 *   customer-id="cust_123"
 *   order-id="ord_456"
 *   token="checkout_abc"
 *   sharing-url="https://merchant.com/product/shoes"
 * ></frak-post-purchase>
 * ```
 */
export function PostPurchase({
    customerId,
    orderId,
    token,
    sharingUrl,
    merchantId,
    placement: placementId,
    classname = "",
    variant: forcedVariant,
    badgeText: propBadgeText,
    referrerText: propReferrerText,
    refereeText: propRefereeText,
    ctaText: propCtaText,
    preview,
    previewVariant,
    products,
    imageUrl: propImageUrl,
}: PostPurchaseProps) {
    const isPreview = !!preview;
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const placement = usePlacement(placementId);
    const lang = useLang();

    useLightDomStyles(
        "frak-post-purchase",
        placementId,
        placement?.components?.postPurchase?.css,
        cssSource,
        sharedBaseCss
    );

    const [context, setContext] = useState<ResolvedPostPurchaseContext | null>(
        null
    );
    const [hasFetched, setHasFetched] = useState(false);

    // Fire-and-forget purchase tracking (fallback for Shopify pixel)
    useEffect(() => {
        if (isPreview) return;
        if (!isClientReady || !customerId || !orderId || !token) return;
        trackPurchaseStatus({
            customerId,
            orderId,
            token,
            merchantId,
        }).catch(() => {
            /* dedup handled server-side */
        });
    }, [isPreview, isClientReady, customerId, orderId, token, merchantId]);

    // Fetch referral status + merchant info in parallel, compute variant locally
    useEffect(() => {
        if (isPreview) return;
        if (!isClientReady || hasFetched) return;
        const client = window.FrakSetup?.client;
        if (!client) return;

        Promise.all([
            getUserReferralStatus(client),
            getMerchantInformation(client),
        ])
            .then(([referralStatus, merchantInfo]) => {
                setHasFetched(true);
                setContext(
                    resolvePostPurchaseContext(
                        referralStatus,
                        merchantInfo,
                        client.config.metadata?.currency
                    )
                );
            })
            .catch((e: unknown) => {
                // Config errors are expected when SDK is not configured — stay hidden
                if (
                    e instanceof FrakRpcError &&
                    e.code === RpcErrorCodes.configError
                ) {
                    setHasFetched(true);
                    return;
                }
                // Transient errors: allow retry on next render
                console.warn("[Frak] Post-purchase context error", e);
            });
    }, [isPreview, isClientReady, hasFetched]);

    // Impression tracking fires once per (mount, variant) pair after the
    // variant is resolved — so preview-mode views, referrer, and referee
    // renders are each counted separately. Ref instead of state to avoid
    // triggering a re-render on each fire.
    const trackedImpressionVariantRef = useRef<"referrer" | "referee" | null>(
        null
    );

    // Resolve variant and reward. In preview mode we synthesise a variant from
    // the `previewVariant` prop so the card renders without backend data.
    const resolvedVariant =
        forcedVariant ??
        context?.variant ??
        (isPreview ? (previewVariant ?? "referrer") : undefined);
    const resolvedSharingUrl = sharingUrl ?? context?.merchantDomain;

    const rewardText = useMemo(() => {
        if (!context?.reward) return undefined;
        const currency = window.FrakSetup?.client?.config?.metadata?.currency;
        return formatRewardOrHide(context.reward, currency);
    }, [context?.reward]);

    const globalComponents = useGlobalComponents();
    const postPurchaseConfig =
        placement?.components?.postPurchase ?? globalComponents?.postPurchase;

    // Badge renders only when text is provided via prop or placement config.
    const resolvedBadgeText = propBadgeText ?? postPurchaseConfig?.badgeText;

    // Custom illustration: prop wins over placement config; falls back to the
    // built-in gift icon when neither provides one.
    const imageUrl = propImageUrl ?? postPurchaseConfig?.imageUrl;

    const texts = useMemo(() => {
        const defaults = componentDefaults[lang].postPurchase;
        const message =
            resolvedVariant === "referee"
                ? rewardText
                    ? applyRewardPlaceholder(
                          propRefereeText ??
                              postPurchaseConfig?.refereeText ??
                              defaults.refereeText,
                          rewardText
                      )
                    : (propRefereeText ??
                      postPurchaseConfig?.refereeNoRewardText ??
                      defaults.refereeNoRewardText)
                : rewardText
                  ? applyRewardPlaceholder(
                        propReferrerText ??
                            postPurchaseConfig?.referrerText ??
                            defaults.referrerText,
                        rewardText
                    )
                  : (propReferrerText ??
                    postPurchaseConfig?.referrerNoRewardText ??
                    defaults.referrerNoRewardText);

        const cta = rewardText
            ? applyRewardPlaceholder(
                  propCtaText ??
                      postPurchaseConfig?.ctaText ??
                      defaults.ctaText,
                  rewardText
              )
            : (propCtaText ??
              postPurchaseConfig?.ctaNoRewardText ??
              defaults.ctaNoRewardText);

        return { message, cta };
    }, [
        lang,
        resolvedVariant,
        rewardText,
        postPurchaseConfig,
        propReferrerText,
        propRefereeText,
        propCtaText,
    ]);

    useEffect(() => {
        if (!resolvedVariant) return;
        if (trackedImpressionVariantRef.current === resolvedVariant) return;
        // Gate on client readiness for every path (preview included) so the
        // impression isn't "tracked" against an undefined client — which would
        // no-op the event yet still flip the ref, suppressing the real fire
        // once the client is ready.
        if (!isClientReady) return;
        if (!isPreview && (!shouldRender || isHidden)) return;
        trackEvent(window.FrakSetup?.client, "post_purchase_impression", {
            placement: placementId,
            variant: resolvedVariant,
            has_reward: Boolean(context?.reward),
        });
        trackedImpressionVariantRef.current = resolvedVariant;
    }, [
        resolvedVariant,
        shouldRender,
        isHidden,
        isClientReady,
        isPreview,
        placementId,
        context?.reward,
    ]);

    // Parse + sanitize the `products` prop. Surfaces that set the prop via
    // the JS property (`el.products = [...]`) deliver a real array; surfaces
    // that bind it as an HTML attribute (WP / Magento server-render) deliver
    // a JSON-stringified array. We treat both as untrusted public-API input:
    // each entry is normalised to a {@link SharingPageProduct} with a
    // non-empty string `title`, and `imageUrl` / `link` are kept only when
    // they parse as `http(s)://` URLs — otherwise downstream
    // `new URL(...)` calls in the sharing-page builder would crash, and a
    // `javascript:` link would be a XSS sink in any consumer that binds the
    // value to an `href`. Unparseable / empty payloads are silently dropped
    // so the share still works without the product card section.
    const parsedProducts = useMemo<SharingPageProduct[] | undefined>(
        () => sanitizeProductList(products),
        [products]
    );

    // Click handler — opens the full-page sharing UI. The sharing page
    // already renders a product card section when `products` is provided
    // (see `apps/listener/.../sharing/component/SharingPage`); the
    // post-purchase card uses this flow rather than the modal-flow share
    // because product cards only exist on the full-page surface. Memoised
    // as a whole so the `<button onClick>` ref stays stable across renders
    // and the click-tracking + share call live in one named callback.
    const handleClick = useCallback(() => {
        if (!resolvedVariant) return;
        trackEvent(window.FrakSetup?.client, "post_purchase_clicked", {
            placement: placementId,
            variant: resolvedVariant,
        });
        openSharingPage(undefined, placementId, {
            link: resolvedSharingUrl,
            products: parsedProducts,
        });
    }, [resolvedVariant, placementId, resolvedSharingUrl, parsedProducts]);

    // Bail conditions: hide when the resolved variant is missing, or when we're
    // in normal (non-preview) mode and the client/context isn't ready yet.
    if (!resolvedVariant) return null;
    if (!isPreview && (!shouldRender || isHidden || !context)) return null;

    const cardClass = [card, classname].filter(Boolean).join(" ");

    return (
        <div className={cardClass}>
            <div class={cardLayout}>
                <div class={cardLeft}>
                    {resolvedBadgeText && (
                        <span class={badge}>{resolvedBadgeText}</span>
                    )}
                    <p class={message}>{texts.message}</p>
                    <button
                        type="button"
                        className={`${cta} button`}
                        disabled={!isPreview && !isClientReady}
                        onClick={isPreview ? undefined : handleClick}
                    >
                        {texts.cta}
                        <svg
                            width="16"
                            height="16"
                            viewBox="0 0 16 16"
                            fill="none"
                            aria-hidden="true"
                            className={`${icon} button`}
                        >
                            <path
                                d="M13.9 11.14C13.99 11.05 14.15 11.11 14.15 11.24V11.64C14.15 13.05 12.63 14.19 10.75 14.19C8.87 14.19 7.34 13.05 7.34 11.64V11.24C7.34 11.11 7.51 11.05 7.59 11.14C8.35 11.93 9.48 12.43 10.75 12.43C12.01 12.43 13.15 11.93 13.9 11.14ZM1.85 9.65C1.85 9.51 2.01 9.44 2.1 9.54C2.85 10.32 3.99 10.82 5.25 10.82C5.52 10.82 5.79 10.8 6.04 10.76C6.26 10.72 6.47 10.88 6.47 11.1V12.17C6.47 12.32 6.37 12.45 6.22 12.48C5.92 12.55 5.59 12.59 5.25 12.59C3.37 12.59 1.85 11.45 1.85 10.04V9.65ZM10.75 6.21C12.63 6.21 14.15 7.35 14.15 8.75C14.15 10.16 12.63 11.3 10.75 11.3C8.87 11.3 7.34 10.16 7.34 8.75C7.34 7.35 8.87 6.21 10.75 6.21ZM1.85 6.85C1.85 6.71 2.01 6.65 2.1 6.74C2.85 7.53 3.99 8.03 5.25 8.03C5.52 8.03 5.79 8 6.04 7.96C6.26 7.92 6.47 8.09 6.47 8.3V9.37C6.47 9.52 6.37 9.65 6.22 9.69C5.92 9.75 5.59 9.79 5.25 9.79C3.37 9.79 1.85 8.65 1.85 7.24V6.85ZM5.25 1.81C7.13 1.81 8.66 2.95 8.66 4.36C8.66 5.76 7.13 6.9 5.25 6.9C3.37 6.9 1.85 5.76 1.85 4.36C1.85 2.95 3.37 1.81 5.25 1.81Z"
                                fill="currentColor"
                            />
                        </svg>
                    </button>
                </div>
                <div class={cardRight}>
                    {imageUrl ? (
                        <span class={imageWrapper}>
                            <img src={imageUrl} alt="" class={customImage} />
                        </span>
                    ) : (
                        <GiftIcon className={giftIcon} width={80} height={80} />
                    )}
                    <LogoFrakWithName
                        className={frakLogo}
                        width={42}
                        height={24}
                    />
                </div>
            </div>
        </div>
    );
}
