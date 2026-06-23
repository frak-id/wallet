import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { UploadIcon } from "@frak-labs/design-system/icons";
import clsx from "clsx";
import { useCallback, useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { imageAccept } from "@/module/merchant/component/ImageUploadField";
import {
    useMediaList,
    useMediaUpload,
} from "@/module/merchant/hook/useMediaUpload";
import { getUploadErrorMessage } from "@/module/merchant/utils/uploadError";
import * as fieldStyles from "../edit-fields.css";
import * as styles from "./multi-hero-images-field.css";

type MultiHeroImagesFieldProps = {
    merchantId: string;
    values: string[];
    onChange: (values: string[]) => void;
    /** URLs already used elsewhere (e.g. the main hero) to hide from the picker. */
    excludeUrls?: string[];
};

const MAX_IMAGES = 4;

export function MultiHeroImagesField({
    merchantId,
    values,
    onChange,
    excludeUrls,
}: MultiHeroImagesFieldProps) {
    const { t } = useTranslation();
    const {
        mutateAsync: uploadAsync,
        isPending,
        error: uploadError,
        reset: resetUpload,
    } = useMediaUpload();
    const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);

    const reachedLimit = values.length >= MAX_IMAGES;

    const onDrop = useCallback(
        async (files: File[]) => {
            // The backend takes one image per request — upload the batch
            // sequentially, appending each slide as it lands.
            const batch = files.slice(0, MAX_IMAGES - values.length);
            if (!batch.length) return;

            resetUpload();
            const next = [...values];
            for (const file of batch) {
                try {
                    const data = await uploadAsync({
                        merchantId,
                        image: file,
                        type: "hero-extra",
                    });
                    if (data?.url) {
                        next.push(data.url);
                        onChange([...next]);
                    }
                } catch {
                    // Surfaced via uploadError (e.g. duplicate image);
                    // keep uploading the rest of the batch.
                }
            }
        },
        [merchantId, uploadAsync, resetUpload, onChange, values]
    );

    // Removing a slide only updates the form value — the bucket file is kept
    // so "Discard changes" can restore the saved config, and it stays
    // pickable in the existing-images list.
    const handleDelete = useCallback(
        (url: string) => {
            onChange(values.filter((v) => v !== url));
        },
        [onChange, values]
    );

    // No maxFiles: dropzone would reject oversized selections wholesale —
    // onDrop slices the batch to the remaining slots instead.
    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: imageAccept,
        multiple: true,
        disabled: isPending || reachedLimit,
        noClick: true,
    });

    const errorMessage = getUploadErrorMessage(uploadError);

    return (
        <Stack space="m">
            {values.length > 0 && (
                <Stack as="ul" space="xs" className={styles.list}>
                    {values.map((url) => (
                        <li
                            key={url}
                            className={styles.item}
                            onMouseEnter={() => setHoveredUrl(url)}
                            onMouseLeave={() =>
                                setHoveredUrl((current) =>
                                    current === url ? null : current
                                )
                            }
                        >
                            <div className={styles.thumb}>
                                <img
                                    src={url}
                                    alt={t("merchantEdit.explorer.heroImage")}
                                    className={styles.image}
                                />
                            </div>
                            <span className={styles.url} title={url}>
                                {url}
                            </span>
                            <button
                                type="button"
                                className={styles.deleteButton}
                                onClick={() => handleDelete(url)}
                                title={t("merchantEdit.explorer.removeImage")}
                            >
                                ✕
                            </button>
                            {hoveredUrl === url && (
                                <div className={styles.preview}>
                                    <img
                                        src={url}
                                        alt={t(
                                            "merchantEdit.explorer.heroImage"
                                        )}
                                        className={styles.image}
                                    />
                                </div>
                            )}
                        </li>
                    ))}
                </Stack>
            )}

            {!reachedLimit && (
                <div
                    {...getRootProps({
                        className: clsx(
                            fieldStyles.dropzone,
                            isDragActive && fieldStyles.dropzoneActive
                        ),
                    })}
                >
                    <input {...getInputProps()} />
                    <IconCircle size="md">
                        <UploadIcon
                            width={24}
                            height={24}
                            className={fieldStyles.dropzoneIcon}
                        />
                    </IconCircle>
                    <Stack space="xs" align="center">
                        <Text variant="body" color="secondary">
                            {isPending
                                ? t("merchantEdit.explorer.uploading")
                                : isDragActive
                                  ? t("merchantEdit.explorer.dropHere")
                                  : t("merchantEdit.explorer.dragAndDrop")}
                        </Text>
                        <Text variant="bodySmall" color="disabled">
                            {t("merchantEdit.explorer.or")}
                        </Text>
                        <Button
                            type="button"
                            variant="primary"
                            size="small"
                            width="auto"
                            onClick={open}
                            disabled={isPending}
                        >
                            {t("merchantEdit.explorer.browseFiles")}
                        </Button>
                        <Text variant="caption" color="disabled" align="center">
                            {`${t("merchantEdit.explorer.restrictions.hero")} — ${values.length}/${MAX_IMAGES}`}
                        </Text>
                    </Stack>
                </div>
            )}

            {errorMessage && (
                <Text variant="caption" color="error">
                    {errorMessage}
                </Text>
            )}

            {!reachedLimit && (
                <ExistingFilePicker
                    merchantId={merchantId}
                    usedUrls={[...values, ...(excludeUrls ?? [])]}
                    onPick={(url) => onChange([...values, url])}
                />
            )}
        </Stack>
    );
}

/** Bucket images not yet used anywhere, addable to the slider in one click. */
function ExistingFilePicker({
    merchantId,
    usedUrls,
    onPick,
}: {
    merchantId: string;
    usedUrls: string[];
    onPick: (url: string) => void;
}) {
    const { t } = useTranslation();
    const { data: files } = useMediaList(merchantId);

    const pickableFiles = useMemo(() => {
        if (!files?.length) return [];
        return files.filter(
            (f) =>
                (f.type === "hero" || f.type.startsWith("hero-")) &&
                !usedUrls.includes(f.url)
        );
    }, [files, usedUrls]);

    if (!pickableFiles.length) return null;

    return (
        <Stack space="xs">
            <Text
                as="span"
                variant="bodySmall"
                weight="medium"
                color="secondary"
                className={fieldStyles.fieldLabel}
            >
                {t("merchantEdit.explorer.useExisting")}
            </Text>
            <Inline space="xs">
                {pickableFiles.map((file) => (
                    <button
                        key={file.url}
                        type="button"
                        className={fieldStyles.thumbnailButton}
                        onClick={() => onPick(file.url)}
                        title={file.type}
                    >
                        <img
                            className={fieldStyles.thumbnailImage}
                            src={file.url}
                            alt={file.type}
                            loading="lazy"
                        />
                    </button>
                ))}
            </Inline>
        </Stack>
    );
}
