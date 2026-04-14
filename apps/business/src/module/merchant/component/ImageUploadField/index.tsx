import { Input } from "@frak-labs/ui/component/forms/Input";
import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
    useMediaDelete,
    useMediaUpload,
} from "@/module/merchant/hook/useMediaUpload";
import styles from "./index.module.css";

type ImageUploadFieldProps = {
    merchantId: string;
    type: "logo" | "hero";
    value: string;
    onChange: (value: string) => void;
    onUploadSuccess: (url: string) => void;
};

const imageAccept = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"],
};

const restrictionsText = {
    logo: "PNG, JPEG, WebP, SVG, GIF — Min 128×128px — Ratio 1:2 to 2:1 — Max 10MB",
    hero: "PNG, JPEG, WebP, SVG, GIF — Min 600×200px — Ratio 3:2 to 4:1 — Max 10MB",
} as const;

export function ImageUploadField({
    merchantId,
    type,
    value,
    onChange,
    onUploadSuccess,
}: ImageUploadFieldProps) {
    const {
        mutate: upload,
        isPending: isUploading,
        error: uploadError,
        isSuccess,
        reset: resetUpload,
    } = useMediaUpload();
    const { mutate: deleteMedia, isPending: isDeleting } = useMediaDelete();

    const isPending = isUploading || isDeleting;

    const [imgError, setImgError] = useState(false);

    const onDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file) return;

            resetUpload();
            setImgError(false);
            upload(
                { merchantId, image: file, type },
                { onSuccess: (data) => onUploadSuccess(data.url) }
            );
        },
        [merchantId, type, upload, resetUpload, onUploadSuccess]
    );

    const handleClear = useCallback(() => {
        resetUpload();
        setImgError(false);
        // Delete from bucket, then clear the field and auto-save
        deleteMedia(
            { merchantId, type },
            { onSettled: () => onUploadSuccess("") }
        );
    }, [merchantId, type, deleteMedia, resetUpload, onUploadSuccess]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: imageAccept,
        maxFiles: 1,
        disabled: isPending,
    });

    const errorMessage = getUploadErrorMessage(uploadError);
    const showPreview = value && !imgError;

    return (
        <div className={styles.imageUploadField}>
            <div className={styles.controls}>
                <div className={styles.inputRow}>
                    <Input
                        length={"medium"}
                        placeholder={"https://..."}
                        value={value}
                        onChange={(e) => {
                            onChange(e.target.value);
                            setImgError(false);
                        }}
                    />
                    {value && (
                        <button
                            type="button"
                            className={styles.clearButton}
                            onClick={handleClear}
                            title="Remove image"
                        >
                            ✕
                        </button>
                    )}
                </div>
                <div
                    {...getRootProps({
                        className: `${styles.dropzone} ${isDragActive ? styles.dropzoneActive : ""} ${isPending ? styles.dropzonePending : ""}`,
                    })}
                >
                    <input {...getInputProps()} />
                    <span className={styles.dropzoneText}>
                        {isPending
                            ? "Uploading..."
                            : isDragActive
                              ? "Drop image here"
                              : "Drag & drop an image, or click to browse"}
                    </span>
                </div>
                <p className={styles.restrictions}>{restrictionsText[type]}</p>
                {errorMessage && <p className={styles.error}>{errorMessage}</p>}
                {isSuccess && <p className={styles.success}>Image uploaded</p>}
            </div>
            {showPreview && (
                <img
                    src={value}
                    alt={`${type} preview`}
                    className={
                        type === "hero"
                            ? styles.previewHero
                            : styles.previewLogo
                    }
                    onError={() => setImgError(true)}
                />
            )}
        </div>
    );
}

function getUploadErrorMessage(error: unknown): string | null {
    if (!error) return null;
    if (
        typeof error === "object" &&
        error !== null &&
        "value" in error &&
        typeof (error as { value: unknown }).value === "object" &&
        (error as { value: null | object }).value !== null &&
        "error" in (error as { value: { error: unknown } }).value
    ) {
        return String((error as { value: { error: string } }).value.error);
    }
    if (error instanceof Error) return error.message;
    return "Upload failed";
}
