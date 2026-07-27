import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Text } from "@frak-labs/design-system/components/Text";
import { EyeIcon } from "@frak-labs/design-system/icons";
import { trackEvent } from "@frak-labs/wallet-shared";
import { mediaSrcSet } from "@frak-labs/wallet-shared/common/utils/mediaSrcSet";
import { memo, useEffect, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useOneShotInView } from "@/module/common/hook/useOneShotInView";
import { FavoriteButton } from "@/module/favorites/component/FavoriteButton";
import { modalStore } from "@/module/stores/modalStore";
import { useCampaignView } from "../../campaignView";
import * as styles from "./index.css";
import { LogoCutout } from "./LogoCutout";

type ExplorerCardProps = {
    merchant: ExplorerMerchantItem;
    /**
     * True for the first cards rendered above the fold — their hero/logo load
     * eagerly (and the hero gets `fetchPriority="high"`) instead of waiting on
     * lazy discovery. Kept as a plain boolean so `memo`'s shallow prop equality
     * still holds across re-renders/sorts.
     */
    priority?: boolean;
};

// Below this many views the count reads as noise rather than social proof, so
// the badge is hidden entirely (the card just shows the favorite heart).
const VIEWS_DISPLAY_THRESHOLD = 50;

// How far below the viewport a card starts fetching its rewards — roughly one
// card height ahead, so the headline is usually resolved by the time the card
// scrolls into view without firing every request on page load.
const REWARDS_FETCH_MARGIN = "300px";

function ExplorerCardComponent({ merchant, priority }: ExplorerCardProps) {
    const { t, i18n } = useTranslation();
    // Open the detail modal from inside the card so the only prop is the
    // (referentially stable) merchant — lets `memo` skip re-rendering every
    // card on a list reorder (sort change) or parent render.
    const openModal = modalStore((s) => s.openModal);
    const { name, domain, explorerConfig } = merchant;
    const heroImageUrl = explorerConfig?.heroImageUrl;
    const logoUrl = explorerConfig?.logoUrl;
    const description = explorerConfig?.description;

    const cardRef = useRef<HTMLElement>(null);

    // Fires once when the card crosses 50% visible. Replaces the legacy
    // global `screen_view` denominator on the wallet funnel so impressions
    // can be scoped per merchant. Re-mounts re-emit by design (list refetch
    // counts as a new view).
    const isViewed = useOneShotInView(cardRef, { threshold: 0.5 });
    useEffect(() => {
        if (!isViewed) return;
        trackEvent("explorer_card_viewed", { merchant_id: merchant.id });
    }, [isViewed, merchant.id]);

    // Defer the per-card rewards request until the card approaches the
    // viewport, so opening the page doesn't fire one request per merchant.
    // Above-the-fold (`priority`) cards fetch immediately. Latches once: a
    // card that was near keeps its data through reorders.
    const isNearViewport = useOneShotInView(cardRef, {
        rootMargin: REWARDS_FETCH_MARGIN,
        initial: priority,
    });

    const view = useCampaignView(merchant.id, { enabled: isNearViewport });

    const showViews = merchant.views >= VIEWS_DISPLAY_THRESHOLD;
    // Compact glyph for the pill (e.g. "1.2K"); the full grouped count lives in
    // the accessible label so screen readers announce the exact number. Built
    // only when the badge is shown to avoid an Intl.NumberFormat per card render.
    const compactViews = useMemo(
        () =>
            showViews
                ? new Intl.NumberFormat(i18n.language, {
                      notation: "compact",
                      maximumFractionDigits: 1,
                  }).format(merchant.views)
                : null,
        [showViews, i18n.language, merchant.views]
    );

    return (
        <Box
            as="article"
            ref={cardRef}
            className={styles.cardWrapper}
            onClick={() => openModal({ id: "explorerDetail", merchant })}
        >
            {/* Hero image area */}
            <Box className={styles.imageWrapper}>
                <FavoriteButton merchantId={merchant.id} />

                {heroImageUrl ? (
                    <img
                        {...mediaSrcSet(heroImageUrl)}
                        alt={name}
                        className={styles.heroImage}
                        loading={priority ? "eager" : "lazy"}
                        decoding="async"
                        fetchPriority={priority ? "high" : undefined}
                    />
                ) : (
                    <Box className={styles.imagePlaceholder} />
                )}

                {logoUrl && (
                    <>
                        <Box className={styles.logoCutoutContainer}>
                            <LogoCutout fill="currentColor" />
                        </Box>
                        <Box className={styles.logoWrapper}>
                            <img
                                {...mediaSrcSet(logoUrl)}
                                alt={`${name} logo`}
                                className={styles.logoImage}
                                loading={priority ? "eager" : "lazy"}
                                decoding="async"
                            />
                        </Box>
                    </>
                )}
            </Box>

            {/* Text content */}
            <Box className={styles.contentWrapper}>
                <Spread space="xs" align="top">
                    <Text as="h2" variant="body" weight="semiBold">
                        {name}
                    </Text>
                    {showViews && (
                        <Inline
                            space="xxs"
                            alignY="center"
                            wrap={false}
                            className={styles.viewsCount}
                            aria-label={t("explorer.card.views", {
                                count: merchant.views,
                            })}
                        >
                            <EyeIcon width={13} height={13} />
                            <Text variant="caption" weight="medium">
                                {compactViews}
                            </Text>
                        </Inline>
                    )}
                </Spread>
                <Text
                    variant="bodySmall"
                    weight="medium"
                    className={
                        view?.headlineReferrerReward
                            ? undefined
                            : styles.descriptionFallback
                    }
                >
                    {view?.headlineReferrerReward ? (
                        <>
                            {t("explorer.detail.rewardPerReferral", {
                                amount: view.headlineReferrerReward,
                            })}
                            {view.formattedEndDate &&
                                ` - ${t("explorer.card.until", { date: view.formattedEndDate })}`}
                        </>
                    ) : (
                        (description ?? domain)
                    )}
                </Text>
            </Box>
        </Box>
    );
}

/**
 * Memoized so a list reorder (sort change) or parent re-render doesn't
 * re-render all cards — `merchant` keeps its reference across sorts, so shallow
 * prop equality holds and only genuinely changed cards re-render.
 */
export const ExplorerCard = memo(ExplorerCardComponent);
