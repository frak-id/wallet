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
    useMediaDelete,
    useMediaList,
    useMediaUpload,
} from "@/module/merchant/hook/useMediaUpload";
import { getUploadErrorMessage } from "@/module/merchant/utils/uploadError";
import * as styles from "./customize.css";

const imageAccept = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"],
};

export function LogoUploadField({
    merchantId,
    value,
    onChange,
    onUploadSuccess,
    // Forwarded by FormControl so the field label focuses the URL input.
    id,
}: {
    merchantId: string;
    value: string;
    onChange: (value: string) => void;
    onUploadSuccess: (url: string) => void;
    id?: string;
}) {
    const { t } = useTranslation();
    const {
        mutate: upload,
        isPending: isUploading,
        error: uploadError,
        reset: resetUpload,
    } = useMediaUpload();
    const { mutate: deleteMedia, isPending: isDeleting } = useMediaDelete();

    const isPending = isUploading || isDeleting;

    const onDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file) return;

            resetUpload();
            upload(
                { merchantId, image: file, type: "logo" },
                { onSuccess: (data) => onUploadSuccess(data.url) }
            );
        },
        [merchantId, upload, resetUpload, onUploadSuccess]
    );

    const handleClear = useCallback(() => {
        resetUpload();
        // Delete from bucket, then clear the field and auto-save
        deleteMedia(
            { merchantId, type: "logo" },
            { onSettled: () => onUploadSuccess("") }
        );
    }, [merchantId, deleteMedia, resetUpload, onUploadSuccess]);

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
                                aria-label={t("customize.identity.logo.remove")}
                            >
                                <CloseIcon width={16} height={16} />
                            </button>
                        ) : undefined
                    }
                />
                <p className={styles.fieldHint}>
                    {t("customize.identity.logo.hint")}
                </p>
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
                            ? t("customize.identity.logo.uploading")
                            : isDragActive
                              ? t("customize.identity.logo.dropActive")
                              : t("customize.identity.logo.dropTitle")}
                    </Text>
                    <Text variant="bodySmall" color="disabled">
                        {t("customize.identity.logo.or")}
                    </Text>
                    <Button
                        type="button"
                        variant="primary"
                        size="small"
                        width="auto"
                        onClick={open}
                        disabled={isPending}
                    >
                        {t("customize.identity.logo.browse")}
                    </Button>
                    <Text variant="caption" color="disabled" align="center">
                        {t("customize.identity.logo.restrictions")}
                    </Text>
                </Stack>
            </div>
            {errorMessage && (
                <Text variant="caption" color="error">
                    {errorMessage}
                </Text>
            )}
            <ExistingFilePicker
                merchantId={merchantId}
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
    currentValue,
    onPick,
}: {
    merchantId: string;
    currentValue: string;
    onPick: (url: string) => void;
}) {
    const { t } = useTranslation();
    const { data: files } = useMediaList(merchantId);

    const pickableFiles = useMemo(() => {
        if (!files?.length) return [];
        return files.filter(
            (file) => file.type === "logo" && file.url !== currentValue
        );
    }, [files, currentValue]);

    if (!pickableFiles.length) return null;

    return (
        <Stack space="xs">
            <span className={styles.fieldLabel}>
                {t("customize.identity.logo.existing")}
            </span>
            <Inline space="xs">
                {pickableFiles.map((file) => (
                    <button
                        key={file.url}
                        type="button"
                        className={styles.thumbnailButton}
                        onClick={() => onPick(file.url)}
                        title={t("customize.identity.logo.existing")}
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
