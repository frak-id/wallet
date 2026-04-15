import type { ExplorerMerchantItem } from "@frak-labs/backend-elysia/orchestration/schemas";
import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { CoinsIcon } from "@frak-labs/design-system/icons";
import {
    estimatedRewardsQueryOptions,
    selectFormattedReward,
} from "@frak-labs/wallet-shared";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";
import { LogoCutout } from "./LogoCutout";

type ExplorerCardProps = {
    merchant: ExplorerMerchantItem;
    onClick?: () => void;
};

export function ExplorerCard({ merchant, onClick }: ExplorerCardProps) {
    const { t, i18n } = useTranslation();
    const { name, domain, explorerConfig } = merchant;
    const heroImageUrl = explorerConfig?.heroImageUrl;
    const logoUrl = explorerConfig?.logoUrl;
    const description = explorerConfig?.description;

    const { data: rewards } = useQuery(
        estimatedRewardsQueryOptions(merchant.id)
    );

    const cardInfo = useMemo(() => {
        if (!rewards || rewards.length === 0) return null;

        const maxReward = selectFormattedReward({})(rewards);
        if (!maxReward) return null;

        let earliestExpiry: string | undefined;
        for (const r of rewards) {
            if (
                r.expiresAt &&
                (!earliestExpiry || r.expiresAt < earliestExpiry)
            ) {
                earliestExpiry = r.expiresAt;
            }
        }

        const formattedExpiry = earliestExpiry
            ? new Date(earliestExpiry).toLocaleDateString(i18n.language, {
                  day: "2-digit",
                  month: "2-digit",
                  year: "numeric",
              })
            : undefined;

        return { maxReward, formattedExpiry };
    }, [rewards, i18n.language]);

    return (
        <Box as="article" className={styles.cardWrapper} onClick={onClick}>
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

                {cardInfo && (
                    <Box as="span" className={styles.badge}>
                        <CoinsIcon width={12} height={12} />
                        <Text variant="tiny" weight="semiBold">
                            {t("explorer.card.badge", {
                                amount: cardInfo.maxReward,
                            })}
                        </Text>
                    </Box>
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
                <Text variant="bodySmall" weight="medium">
                    {cardInfo ? (
                        <>
                            {t("explorer.detail.rewardPerReferral", {
                                amount: cardInfo.maxReward,
                            })}
                            {cardInfo.formattedExpiry &&
                                ` - ${t("explorer.card.until", { date: cardInfo.formattedExpiry })}`}
                        </>
                    ) : (
                        (description ?? domain)
                    )}
                </Text>
            </Box>
        </Box>
    );
}
