import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import {
    useMediaDelete,
    useMediaUpload,
} from "@/module/merchant/hook/useMediaUpload";
import styles from "./index.module.css";

type MultiHeroImagesFieldProps = {
    merchantId: string;
    values: string[];
    onChange: (values: string[]) => void;
};

const MAX_IMAGES = 4;

const imageAccept = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"],
};

const restrictionsText =
    "PNG, JPEG, WebP, SVG, GIF — Min 600×200px — Ratio 3:2 to 4:1 — Max 10MB";

// Extract storage key (e.g. "hero-abc12345") from a stored URL.
function urlToType(url: string): string | null {
    const match = url.match(/\/([^/]+)\.(?:webp|svg)(?:\?.*)?$/);
    return match?.[1] ?? null;
}

export function MultiHeroImagesField({
    merchantId,
    values,
    onChange,
}: MultiHeroImagesFieldProps) {
    const {
        mutate: upload,
        isPending: isUploading,
        error: uploadError,
        reset: resetUpload,
    } = useMediaUpload();
    const { mutate: deleteMedia } = useMediaDelete();
    const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);

    const reachedLimit = values.length >= MAX_IMAGES;
    const isPending = isUploading;

    const onDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file || reachedLimit) return;

            resetUpload();
            upload(
                { merchantId, image: file, type: "hero-extra" },
                {
                    onSuccess: (data) => {
                        if (!data?.url) return;
                        onChange([...values, data.url]);
                    },
                }
            );
        },
        [merchantId, upload, resetUpload, onChange, values, reachedLimit]
    );

    const handleDelete = useCallback(
        (url: string) => {
            const type = urlToType(url);
            const remaining = values.filter((v) => v !== url);
            if (type) {
                deleteMedia({ merchantId, type });
            }
            onChange(remaining);
        },
        [merchantId, deleteMedia, onChange, values]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: imageAccept,
        maxFiles: 1,
        disabled: isPending || reachedLimit,
    });

    const errorMessage = getUploadErrorMessage(uploadError);

    return (
        <div className={styles.field}>
            {values.length > 0 && (
                <ul className={styles.list}>
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
                                <img src={url} alt="Hero variant" />
                            </div>
                            <span className={styles.url} title={url}>
                                {url}
                            </span>
                            <button
                                type="button"
                                className={styles.deleteButton}
                                onClick={() => handleDelete(url)}
                                title="Remove image"
                            >
                                ✕
                            </button>
                            {hoveredUrl === url && (
                                <div className={styles.preview}>
                                    <img src={url} alt="Hero preview" />
                                </div>
                            )}
                        </li>
                    ))}
                </ul>
            )}

            {!reachedLimit && (
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
                              : `Add image (${values.length}/${MAX_IMAGES})`}
                    </span>
                </div>
            )}

            <p className={styles.restrictions}>{restrictionsText}</p>
            {errorMessage && <p className={styles.error}>{errorMessage}</p>}
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
