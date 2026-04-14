import type {
    EstimatedReward,
    GetMerchantInformationReturnType,
    UserReferralStatusType,
} from "@frak-labs/core-sdk";
import {
    getMerchantInformation,
    getUserReferralStatus,
    trackPurchaseStatus,
} from "@frak-labs/core-sdk/actions";
import { Box } from "@frak-labs/design-system/components/Box";
import { Column } from "@frak-labs/design-system/components/Column";
import { Columns } from "@frak-labs/design-system/components/Columns";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { LogoFrak } from "@frak-labs/design-system/icons";
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useGlobalComponents } from "@/hooks/useGlobalComponents";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import {
    applyRewardPlaceholder,
    formatEstimatedReward,
} from "@/utils/formatReward";
import { useShareModal } from "../ButtonShare/hooks/useShareModal";
import { GiftIcon } from "../icons/GiftIcon";
import {
    badge,
    card,
    cssSource,
    cta,
    frakLogo,
    giftIcon,
    icon,
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
    merchantInfo: GetMerchantInformationReturnType
): ResolvedPostPurchaseContext | null {
    // Find the first purchase reward that has at least one side (referrer or referee)
    const purchaseReward = merchantInfo.rewards.find(
        (r) => r.interactionTypeKey === "purchase" && (r.referrer || r.referee)
    );

    if (!purchaseReward) return null;

    const variant =
        referralStatus?.isReferred && purchaseReward.referee
            ? "referee"
            : "referrer";

    const reward =
        variant === "referee"
            ? purchaseReward.referee
            : purchaseReward.referrer;

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
}: PostPurchaseProps) {
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const placement = usePlacement(placementId);

    useLightDomStyles(
        "frak-post-purchase",
        placementId,
        placement?.components?.postPurchase?.css,
        cssSource
    );

    const [context, setContext] = useState<ResolvedPostPurchaseContext | null>(
        null
    );
    const [hasFetched, setHasFetched] = useState(false);

    // Fire-and-forget purchase tracking (fallback for Shopify pixel)
    useEffect(() => {
        if (!isClientReady || !customerId || !orderId || !token) return;
        trackPurchaseStatus({
            customerId,
            orderId,
            token,
            merchantId,
        }).catch(() => {
            /* dedup handled server-side */
        });
    }, [isClientReady, customerId, orderId, token, merchantId]);

    // Fetch referral status + merchant info in parallel, compute variant locally
    useEffect(() => {
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
                    resolvePostPurchaseContext(referralStatus, merchantInfo)
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
    }, [isClientReady, hasFetched]);

    // Resolve variant and reward
    const resolvedVariant = forcedVariant ?? context?.variant;
    const resolvedSharingUrl = sharingUrl ?? context?.merchantDomain;

    const rewardText = useMemo(() => {
        if (!context?.reward) return undefined;
        const currency = window.FrakSetup?.client?.config?.metadata?.currency;
        return formatEstimatedReward(context.reward, currency);
    }, [context?.reward]);

    const globalComponents = useGlobalComponents();
    const postPurchaseConfig =
        placement?.components?.postPurchase ?? globalComponents?.postPurchase;

    // Badge renders only when text is provided via prop or placement config.
    const resolvedBadgeText = propBadgeText ?? postPurchaseConfig?.badgeText;

    const texts = useMemo(() => {
        const message =
            resolvedVariant === "referee"
                ? rewardText
                    ? applyRewardPlaceholder(
                          propRefereeText ??
                              postPurchaseConfig?.refereeText ??
                              "You just earned {REWARD}! Share with friends to earn even more.",
                          rewardText
                      )
                    : (propRefereeText ??
                      postPurchaseConfig?.refereeNoRewardText ??
                      "You just earned a reward! Share with friends to earn even more.")
                : rewardText
                  ? applyRewardPlaceholder(
                        propReferrerText ??
                            postPurchaseConfig?.referrerText ??
                            "Earn {REWARD} by sharing this with your friends!",
                        rewardText
                    )
                  : (propReferrerText ??
                    postPurchaseConfig?.referrerNoRewardText ??
                    "Share this with your friends and earn rewards!");

        const cta = rewardText
            ? applyRewardPlaceholder(
                  propCtaText ??
                      postPurchaseConfig?.ctaText ??
                      "Share & earn {REWARD}",
                  rewardText
              )
            : (propCtaText ??
              postPurchaseConfig?.ctaNoRewardText ??
              "Share & earn");

        return { message, cta };
    }, [
        resolvedVariant,
        rewardText,
        postPurchaseConfig,
        propReferrerText,
        propRefereeText,
        propCtaText,
    ]);

    // Reuse shared share-modal hook (includes error tracking + debug info)
    const { handleShare } = useShareModal(
        undefined,
        placementId,
        resolvedSharingUrl
    );

    // Bail conditions
    if (!shouldRender || isHidden) return null;
    if (!context || !resolvedVariant) return null;

    const cardClass = [card, classname].filter(Boolean).join(" ");

    return (
        <Box className={cardClass} padding="m">
            <Columns space="xl" alignY="center">
                <Column>
                    <Stack space="xs">
                        {resolvedBadgeText && (
                            <span class={badge}>{resolvedBadgeText}</span>
                        )}
                        <p class={message}>{texts.message}</p>
                        <Box
                            as="button"
                            type="button"
                            className={`${cta} button`}
                            disabled={!isClientReady}
                            onClick={handleShare}
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
                                    d="M13.8984 11.144C13.9864 11.052 14.1543 11.1114 14.1543 11.2388V11.644C14.1543 13.0509 12.6288 14.1918 10.7471 14.1919C8.86523 14.1919 7.33984 13.051 7.33984 11.644V11.2388C7.33984 11.1114 7.50675 11.052 7.59473 11.144C8.3452 11.9295 9.47906 12.4292 10.7471 12.4292C12.0149 12.4291 13.148 11.9293 13.8984 11.144ZM1.8457 9.64795C1.8457 9.51169 2.01094 9.44452 2.10254 9.54053C2.85304 10.3238 3.98586 10.8247 5.25293 10.8247C5.52246 10.8247 5.78608 10.8026 6.04102 10.7593C6.25744 10.7225 6.46582 10.8816 6.46582 11.1011V12.1704C6.46564 12.319 6.36769 12.4507 6.22266 12.4829C5.91535 12.5512 5.58981 12.5874 5.25293 12.5874C3.3711 12.5874 1.8457 11.4469 1.8457 10.0396V9.64795ZM10.7471 6.20654C12.6288 6.20666 14.1543 7.3475 14.1543 8.75439C14.1541 10.1612 12.6287 11.3012 10.7471 11.3013C8.86535 11.3013 7.34004 10.1612 7.33984 8.75439C7.33984 7.34743 8.86523 6.20654 10.7471 6.20654ZM1.8457 6.8501C1.84597 6.71385 2.01208 6.64848 2.10352 6.74365C2.85393 7.52827 3.98602 8.0278 5.25293 8.02783C5.52282 8.02783 5.78667 8.00448 6.04199 7.96143C6.258 7.92499 6.46582 8.08514 6.46582 8.3042V9.37256C6.46582 9.52127 6.36783 9.65378 6.22266 9.68604C5.91537 9.75429 5.58979 9.79053 5.25293 9.79053C3.3711 9.79048 1.8457 8.64863 1.8457 7.24268V6.8501ZM5.25293 1.80811C7.13481 1.80811 8.66016 2.94856 8.66016 4.35596C8.66008 5.76331 7.13476 6.90381 5.25293 6.90381C3.37115 6.90376 1.84578 5.76328 1.8457 4.35596C1.8457 2.94858 3.3711 1.80815 5.25293 1.80811Z"
                                    fill="currentColor"
                                />
                            </svg>
                        </Box>
                    </Stack>
                </Column>
                <Column width="content">
                    <Stack space="xs" align="right">
                        <GiftIcon className={giftIcon} width={80} height={80} />
                        <LogoFrak className={frakLogo} width={14} height={14} />
                    </Stack>
                </Column>
            </Columns>
        </Box>
    );
}
