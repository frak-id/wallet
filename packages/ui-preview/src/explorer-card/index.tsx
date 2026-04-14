import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import { LogoCutout } from "./LogoCutout";
import * as styles from "./styles.css";

export type ExplorerCardPreviewProps = {
    /**
     * Merchant / shop name displayed as the card title.
     */
    name: string;
    /**
     * Hero image URL for the card background.
     */
    heroImageUrl?: string;
    /**
     * Logo URL displayed with a cutout effect over the hero image.
     */
    logoUrl?: string;
    /**
     * Short description shown below the name.
     * Falls back to the domain if not provided.
     */
    description?: string;
};

/**
 * Preview of the explorer card as rendered in the Frak wallet.
 * Shows hero image, logo with cutout effect, name and description.
 */
export function ExplorerCardPreview({
    name,
    heroImageUrl,
    logoUrl,
    description,
}: ExplorerCardPreviewProps) {
    return (
        <Box as="article" className={styles.cardWrapper}>
            {/* Hero image area */}
            <Box className={styles.imageWrapper}>
                {heroImageUrl ? (
                    <img
                        src={heroImageUrl}
                        alt={name}
                        className={styles.heroImage}
                    />
                ) : (
                    <Box className={styles.imagePlaceholder} />
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
                {description && (
                    <Text variant="bodySmall" weight="medium">
                        {description}
                    </Text>
                )}
            </Box>
        </Box>
    );
}
