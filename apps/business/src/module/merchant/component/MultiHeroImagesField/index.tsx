import { Button } from "@frak-labs/design-system/components/Button";
import { FieldLabel } from "@frak-labs/design-system/components/FieldLabel";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { UploadIcon } from "@frak-labs/design-system/icons";
import { visuallyHidden } from "@frak-labs/design-system/utils";
import clsx from "clsx";
import type { TFunction } from "i18next";
import { useCallback, useMemo } from "react";
import { type DropzoneState, useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import { imageAccept } from "@/module/merchant/component/ImageUploadField";
import { ImagePreview } from "@/module/merchant/component/ImageUploadField/ImagePreview";
import { useImageCrop } from "@/module/merchant/hook/useImageCrop";
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

type DropzoneProps = {
    dropzone: DropzoneState;
    isPending: boolean;
    progress: string;
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
    const { prepareImage, cropDialog } = useImageCrop("hero");

    const reachedLimit = values.length >= MAX_IMAGES;

    const onDrop = useCallback(
        async (files: File[]) => {
            // The backend takes one image per request — upload the batch
            // sequentially, appending each slide as it lands.
            const batch = files.slice(0, MAX_IMAGES - values.length);
            if (!batch.length) return;

            resetUpload();
            const next = [...values];
            for (const picked of batch) {
                const file = await prepareImage(picked);
                if (!file) continue;
                try {
                    const data = await uploadAsync({
                        merchantId,
                        image: file,
                        type: "hero-extra",
                    });
                    // The backend dedupes files and can return a URL already
                    // in the slider — don't append it twice.
                    if (data?.url && !next.includes(data.url)) {
                        next.push(data.url);
                        onChange([...next]);
                    }
                } catch {
                    // Surfaced via uploadError (e.g. duplicate image);
                    // keep uploading the rest of the batch.
                }
            }
        },
        [merchantId, uploadAsync, resetUpload, onChange, values, prepareImage]
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

    // Without maxFiles the accepted batch is uncapped, so onDrop slices it
    // down to the slots still free. The visible buttons are the keyboard path.
    const dropzone = useDropzone({
        onDrop,
        accept: imageAccept,
        multiple: true,
        disabled: isPending || reachedLimit,
        noClick: true,
        noKeyboard: true,
    });

    const errorMessage = getUploadErrorMessage(uploadError, t);
    const progress = `${values.length}/${MAX_IMAGES}`;

    return (
        <Stack space="m">
            {values.length === 0 ? (
                <EmptyDropzone
                    dropzone={dropzone}
                    isPending={isPending}
                    progress={progress}
                />
            ) : (
                <ul className={styles.grid}>
                    {[...new Set(values)].map((url, index) => {
                        const slide = { index: index + 1 };
                        return (
                            <li key={url}>
                                <ImagePreview
                                    src={url}
                                    size="medium"
                                    alt={t(
                                        "merchantEdit.explorer.slide",
                                        slide
                                    )}
                                    removeLabel={t(
                                        "merchantEdit.explorer.removeSlide",
                                        slide
                                    )}
                                    onRemove={() => handleDelete(url)}
                                    start={
                                        <Text
                                            variant="bodySmall"
                                            weight="medium"
                                            color="secondary"
                                        >
                                            {t(
                                                "merchantEdit.explorer.slide",
                                                slide
                                            )}
                                        </Text>
                                    }
                                />
                            </li>
                        );
                    })}
                    {!reachedLimit && (
                        <li className={styles.addItem}>
                            <AddTile
                                dropzone={dropzone}
                                isPending={isPending}
                                progress={progress}
                            />
                        </li>
                    )}
                </ul>
            )}

            {cropDialog}
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

function dropzoneLabel(
    t: TFunction,
    isPending: boolean,
    isDragActive: boolean,
    idle: string
) {
    if (isPending) return t("merchantEdit.explorer.uploading");
    if (isDragActive) return t("merchantEdit.explorer.dropHere");
    return idle;
}

function EmptyDropzone({ dropzone, isPending, progress }: DropzoneProps) {
    const { t } = useTranslation();
    const { getRootProps, getInputProps, isDragActive, open } = dropzone;

    return (
        <div
            {...getRootProps({
                className: clsx(
                    fieldStyles.dropzone,
                    isDragActive && fieldStyles.dropzoneActive
                ),
            })}
        >
            {/* react-dropzone sizes the input inline, and those rules win over
                the class. Only `position: absolute` is needed here: it takes
                the input out of flow so the flex column stops reserving a gap. */}
            <input {...getInputProps({ className: visuallyHidden })} />
            <IconCircle size="md">
                <UploadIcon
                    width={24}
                    height={24}
                    className={fieldStyles.dropzoneIcon}
                />
            </IconCircle>
            <Stack space="xs" align="center">
                <Text variant="body" color="secondary">
                    {dropzoneLabel(
                        t,
                        isPending,
                        isDragActive,
                        t("merchantEdit.explorer.dragAndDrop")
                    )}
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
                    {`${t("merchantEdit.explorer.restrictions.hero")} — ${progress}`}
                </Text>
            </Stack>
        </div>
    );
}

/** The grid's last tile: click or drop to add slides. */
function AddTile({ dropzone, isPending, progress }: DropzoneProps) {
    const { t } = useTranslation();
    const { getRootProps, getInputProps, isDragActive, open } = dropzone;
    const label = dropzoneLabel(
        t,
        isPending,
        isDragActive,
        t("merchantEdit.explorer.addImage")
    );

    return (
        <div {...getRootProps({ className: styles.addTile })}>
            <input {...getInputProps({ className: visuallyHidden })} />
            <button
                type="button"
                className={styles.addButton}
                data-active={isDragActive || undefined}
                aria-label={`${label} (${progress})`}
                onClick={open}
                disabled={isPending}
            >
                <UploadIcon
                    width={24}
                    height={24}
                    className={fieldStyles.dropzoneIcon}
                />
                <Text
                    as="span"
                    variant="bodySmall"
                    weight="medium"
                    color="action"
                >
                    {label}
                </Text>
                <Text as="span" variant="caption" color="tertiary">
                    {progress}
                </Text>
            </button>
        </div>
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
        <FieldLabel label={t("merchantEdit.explorer.useExisting")}>
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
        </FieldLabel>
    );
}
