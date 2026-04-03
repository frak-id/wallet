import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { CoinsIcon } from "@frak-labs/design-system/icons";
import { useTranslation } from "react-i18next";
import * as styles from "./index.css";
import { LogoCutout } from "./LogoCutout";
import type { ExplorerMerchantItem } from "./types";

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

                {merchant.maxRewardEur != null && (
                    <Box as="span" className={styles.badge}>
                        <CoinsIcon width={12} height={12} />
                        <Text variant="tiny" weight="semiBold">
                            {t("explorer.card.badge", {
                                amount: merchant.maxRewardEur,
                            })}
                        </Text>
                    </Box>
                )}

                {logoUrl && (
                    <>
                        {/* SVG cutout shape behind logo for inverted border radius */}
                        <Box className={styles.logoCutoutContainer}>
                            <LogoCutout fill="currentColor" />
                        </Box>

                        {/* Brand logo */}
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
                    {description ?? domain}
                </Text>
            </Box>
        </Box>
    );
}
