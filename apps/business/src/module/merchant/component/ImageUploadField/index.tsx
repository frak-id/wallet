import { Button } from "@frak-labs/design-system/components/Button";
import { IconCircle } from "@frak-labs/design-system/components/IconCircle";
import { Inline } from "@frak-labs/design-system/components/Inline";
import { Input } from "@frak-labs/design-system/components/Input";
import { Stack } from "@frak-labs/design-system/components/Stack";
import { Text } from "@frak-labs/design-system/components/Text";
import { CloseIcon, UploadIcon } from "@frak-labs/design-system/icons";
import clsx from "clsx";
import { useCallback, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useTranslation } from "react-i18next";
import {
    useMediaList,
    useMediaUpload,
} from "@/module/merchant/hook/useMediaUpload";
import { getUploadErrorMessage } from "@/module/merchant/utils/uploadError";
import * as styles from "../edit-fields.css";

type ImageUploadFieldProps = {
    merchantId: string;
    type: "logo" | "hero";
    value: string;
    onChange: (value: string) => void;
    onUploadSuccess: (url: string) => void;
    /** Optional hint rendered under the URL input. */
    hint?: string;
    // Forwarded by FormControl so the field label focuses the URL input.
    id?: string;
};

export const imageAccept = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"],
};

export function ImageUploadField({
    merchantId,
    type,
    value,
    onChange,
    onUploadSuccess,
    hint,
    id,
}: ImageUploadFieldProps) {
    const { t } = useTranslation();
    const {
        mutate: upload,
        isPending,
        error: uploadError,
        isSuccess,
        reset: resetUpload,
    } = useMediaUpload();

    const onDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file) return;

            resetUpload();
            upload(
                { merchantId, image: file, type },
                { onSuccess: (data) => onUploadSuccess(data.url) }
            );
        },
        [merchantId, type, upload, resetUpload, onUploadSuccess]
    );

    // Clearing only updates the form value — the bucket file is kept so
    // "Discard changes" can restore the saved config, and it stays pickable
    // in the existing-images list.
    const handleClear = useCallback(() => {
        resetUpload();
        onUploadSuccess("");
    }, [resetUpload, onUploadSuccess]);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        accept: imageAccept,
        maxFiles: 1,
        disabled: isPending,
        noClick: true,
    });

    const errorMessage = getUploadErrorMessage(uploadError);

    return (
        <Stack space="m">
            <Stack space="xxs">
                <Input
                    id={id}
                    variant="bare"
                    tone="muted"
                    placeholder={"https://..."}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    rightSection={
                        value ? (
                            <button
                                type="button"
                                className={styles.clearButton}
                                onClick={handleClear}
                                aria-label={t(
                                    "merchantEdit.explorer.removeImage"
                                )}
                            >
                                <CloseIcon width={24} height={24} />
                            </button>
                        ) : undefined
                    }
                />
                {hint && <p className={styles.fieldHint}>{hint}</p>}
            </Stack>
            <div
                {...getRootProps({
                    className: clsx(
                        styles.dropzone,
                        isDragActive && styles.dropzoneActive
                    ),
                })}
            >
                <input {...getInputProps()} />
                <IconCircle size="md">
                    <UploadIcon
                        width={24}
                        height={24}
                        className={styles.dropzoneIcon}
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
                        {t(`merchantEdit.explorer.restrictions.${type}`)}
                    </Text>
                </Stack>
            </div>
            {errorMessage && (
                <Text variant="caption" color="error">
                    {errorMessage}
                </Text>
            )}
            {isSuccess && (
                <Text variant="caption" color="success">
                    {t("merchantEdit.explorer.uploaded")}
                </Text>
            )}
            <ExistingFilePicker
                merchantId={merchantId}
                type={type}
                currentValue={value}
                onPick={(url) => {
                    onChange(url);
                    onUploadSuccess(url);
                }}
            />
        </Stack>
    );
}

function ExistingFilePicker({
    merchantId,
    type,
    currentValue,
    onPick,
}: {
    merchantId: string;
    type: "logo" | "hero";
    currentValue: string;
    onPick: (url: string) => void;
}) {
    const { t } = useTranslation();
    const { data: files } = useMediaList(merchantId);

    // Show files matching the same type (logo → logo, hero → hero or hero-{variant}),
    // excluding the file currently selected in the input.
    const pickableFiles = useMemo(() => {
        if (!files?.length) return [];
        return files.filter((f) => {
            if (f.url === currentValue) return false;
            if (type === "logo") return f.type === "logo";
            return f.type === "hero" || f.type.startsWith("hero-");
        });
    }, [files, type, currentValue]);

    if (!pickableFiles.length) return null;

    return (
        <Stack space="xs">
            <Text
                as="span"
                variant="bodySmall"
                weight="medium"
                color="secondary"
                className={styles.fieldLabel}
            >
                {t("merchantEdit.explorer.useExisting")}
            </Text>
            <Inline space="xs">
                {pickableFiles.map((file) => (
                    <button
                        key={file.url}
                        type="button"
                        className={styles.thumbnailButton}
                        onClick={() => onPick(file.url)}
                        title={file.type}
                    >
                        <img
                            className={styles.thumbnailImage}
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
