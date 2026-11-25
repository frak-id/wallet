import { Button } from "@frak-labs/design-system/components/Button";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { BinIcon, ImageIcon } from "@frak-labs/design-system/icons";
import type { RecipeVariants } from "@vanilla-extract/recipes";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import * as styles from "./image-preview.css";

type ImagePreviewProps = {
    src: string;
    size: NonNullable<RecipeVariants<typeof styles.frame>>["size"];
    /** Footer start: an Edit button, a slide label. */
    start: ReactNode;
    onRemove: () => void;
    alt?: string;
    /** Must contain the visible "Remove image" text. */
    removeLabel?: string;
};

/** An uploaded image, so the merchant sees it even where the phone preview is hidden. */
export function ImagePreview({
    src,
    size,
    start,
    onRemove,
    alt,
    removeLabel,
}: ImagePreviewProps) {
    const { t } = useTranslation();
    const [failedSrc, setFailedSrc] = useState<string | null>(null);

    return (
        <div className={styles.card}>
            <div className={styles.frame({ size })}>
                {failedSrc === src ? (
                    <Stack space="xs" align="center">
                        <ImageIcon
                            width={24}
                            height={24}
                            className={styles.fallbackIcon}
                        />
                        <Text variant="caption" color="tertiary">
                            {t("merchantEdit.explorer.imageUnavailable")}
                        </Text>
                    </Stack>
                ) : (
                    <img
                        className={styles.image}
                        src={src}
                        alt={alt ?? t("merchantEdit.explorer.currentImage")}
                        onError={() => setFailedSrc(src)}
                    />
                )}
            </div>
            <Inline
                space="s"
                align="space-between"
                alignY="center"
                padding="s"
                wrap={false}
            >
                {start}
                <Button
                    type="button"
                    variant="ghost"
                    size="small"
                    width="auto"
                    icon={<BinIcon width={16} height={16} />}
                    aria-label={removeLabel}
                    onClick={onRemove}
                >
                    {t("merchantEdit.explorer.removeImage")}
                </Button>
            </Inline>
        </div>
    );
}
