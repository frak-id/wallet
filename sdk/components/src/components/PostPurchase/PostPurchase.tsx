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
import { FrakRpcError, RpcErrorCodes } from "@frak-labs/frame-connector";
import { useEffect, useMemo, useState } from "preact/hooks";
import { useClientReady } from "@/hooks/useClientReady";
import { useLightDomStyles } from "@/hooks/useLightDomStyles";
import { usePlacement } from "@/hooks/usePlacement";
import { formatEstimatedReward } from "@/utils/formatReward";
import { useShareModal } from "../ButtonShare/hooks/useShareModal";
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
}: PostPurchaseProps) {
    const { shouldRender, isHidden, isClientReady } = useClientReady();
    const placement = usePlacement(placementId);

    useLightDomStyles(
        "frak-post-purchase",
        placementId,
        placement?.components?.postPurchase?.css
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

        setHasFetched(true);

        Promise.all([
            getUserReferralStatus(client),
            getMerchantInformation(client),
        ])
            .then(([referralStatus, merchantInfo]) => {
                setContext(
                    resolvePostPurchaseContext(referralStatus, merchantInfo)
                );
            })
            .catch((e: unknown) => {
                // Silently swallow RPC errors — component stays hidden
                if (
                    e instanceof FrakRpcError &&
                    e.code === RpcErrorCodes.configError
                ) {
                    return;
                }
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

    // Reuse shared share-modal hook (includes error tracking + debug info)
    const { handleShare } = useShareModal(
        undefined,
        placementId,
        resolvedSharingUrl
    );

    // Bail conditions
    if (!shouldRender || isHidden) return null;
    if (!context || !resolvedVariant) return null;

    const cardClass = ["post-purchase", classname].filter(Boolean).join(" ");

    return (
        <div class={cardClass}>
            <div class="post-purchase__content">
                {resolvedVariant === "referee" ? (
                    <p class="post-purchase__message">
                        {rewardText
                            ? `You just earned ${rewardText}! Share with friends to earn even more.`
                            : "You just earned a reward! Share with friends to earn even more."}
                    </p>
                ) : (
                    <p class="post-purchase__message">
                        {rewardText
                            ? `Earn ${rewardText} by sharing this with your friends!`
                            : "Share this with your friends and earn rewards!"}
                    </p>
                )}
            </div>
            <button
                type="button"
                class="post-purchase__cta button"
                disabled={!isClientReady}
                onClick={handleShare}
            >
                {rewardText ? `Share & earn ${rewardText}` : "Share & earn"}
            </button>
        </div>
    );
}
