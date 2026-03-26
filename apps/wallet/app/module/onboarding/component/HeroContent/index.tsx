import { Box } from "@frak-labs/design-system/components/Box";
import { Text } from "@frak-labs/design-system/components/Text";
import type { ReactNode } from "react";
import * as styles from "./index.css";

type HeroContentProps = {
    /** Content rendered inside the image area */
    image: ReactNode;
    /** Image area layout variant */
    imageVariant?: "cover" | "center";
    /** When true, image bleeds to edges (no horizontal margin) */
    bleed?: boolean;
    title: ReactNode;
    description: ReactNode;
};

export function HeroContent({
    image,
    imageVariant = "center",
    bleed = false,
    title,
    description,
}: HeroContentProps) {
    const imageClassName =
        imageVariant === "cover"
            ? styles.heroImage
            : bleed
              ? styles.heroImageCenterBleed
              : styles.heroImageCenter;

    return (
        <>
            <Box className={imageClassName}>{image}</Box>
            <Box className={styles.heroContent}>
                <Text variant="heading1" as="h2" className={styles.heroTitle}>
                    {title}
                </Text>
                <Box className={styles.heroDescription}>{description}</Box>
            </Box>
        </>
    );
}
