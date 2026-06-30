import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { trackEvent } from "@frak-labs/wallet-shared";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useCampaignView } from "../../campaignView";
import * as styles from "./index.css";
import { LogoCutout } from "./LogoCutout";

type ExplorerCardProps = {
    merchant: ExplorerMerchantItem;
    onClick?: () => void;
};

export function ExplorerCard({ merchant, onClick }: ExplorerCardProps) {
    const { t } = useTranslation();
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

    return (
        <Box
            as="article"
            ref={cardRef}
            className={styles.cardWrapper}
            onClick={onClick}
        >
            {/* Hero image area */}
            <Box className={styles.imageWrapper}>
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
                <Text as="h2" variant="body" weight="semiBold">
                    {name}
                </Text>
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
