import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Spread } from "@frak-labs/design-system/components/Spread";
import { Text } from "@frak-labs/design-system/components/Text";
import { EyeIcon } from "@frak-labs/design-system/icons";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { FavoriteButton } from "@/module/favorites/component/FavoriteButton";
import { useCampaignView } from "../../campaignView";
import * as styles from "./index.css";
import { LogoCutout } from "./LogoCutout";

type ExplorerCardProps = {
    merchant: ExplorerMerchantItem;
    onClick?: () => void;
};

// Below this many views the count reads as noise rather than social proof, so
// the badge is hidden entirely (the card just shows the favorite heart).
const VIEWS_DISPLAY_THRESHOLD = 50;

export function ExplorerCard({ merchant, onClick }: ExplorerCardProps) {
    const { t, i18n } = useTranslation();
    const { name, domain, explorerConfig } = merchant;
    const heroImageUrl = explorerConfig?.heroImageUrl;
    const logoUrl = explorerConfig?.logoUrl;
    const description = explorerConfig?.description;

    const cardRef = useRef<HTMLElement>(null);

    // Fires once when the card crosses 50% visible, then disconnects.
    // Replaces the legacy global `screen_view` denominator on the wallet
    // funnel so impressions can be scoped per merchant. Re-mounts re-emit
    // by design (list refetch counts as a new view).
    useEffect(() => {
        const el = cardRef.current;
        if (!el) return;
        let tracked = false;
        const observer = new IntersectionObserver(
            (entries) => {
                if (tracked) return;
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        tracked = true;
                        trackEvent("explorer_card_viewed", {
                            merchant_id: merchant.id,
                        });
                        observer.disconnect();
                        break;
                    }
                }
            },
            { threshold: 0.5 }
        );
        observer.observe(el);
        return () => observer.disconnect();
    }, [merchant.id]);

    const view = useCampaignView(merchant.id);

    const showViews = merchant.views >= VIEWS_DISPLAY_THRESHOLD;
    // Compact glyph for the pill (e.g. "1.2K"); the full grouped count lives in
    // the accessible label so screen readers announce the exact number.
    const compactViews = new Intl.NumberFormat(i18n.language, {
        notation: "compact",
        maximumFractionDigits: 1,
    }).format(merchant.views);

    return (
        <Box
            as="article"
            ref={cardRef}
            className={styles.cardWrapper}
            onClick={onClick}
        >
            {/* Hero image area */}
            <Box className={styles.imageWrapper}>
                <FavoriteButton merchantId={merchant.id} />

                {heroImageUrl ? (
                    <img
                        src={heroImageUrl}
                        alt={name}
                        className={styles.heroImage}
                        loading="lazy"
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
                                src={logoUrl}
                                alt={`${name} logo`}
                                className={styles.logoImage}
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
