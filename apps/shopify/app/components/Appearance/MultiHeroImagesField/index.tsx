import { useCallback, useEffect, useRef, useState } from "react";
import { useDropzone } from "react-dropzone";
import { useFetcher } from "react-router";
import styles from "./index.module.css";

type MultiHeroImagesFieldProps = {
    label: string;
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
    label,
    values,
    onChange,
}: MultiHeroImagesFieldProps) {
    const uploadFetcher = useFetcher();
    const deleteFetcher = useFetcher();
    const [hoveredUrl, setHoveredUrl] = useState<string | null>(null);
    const lastHandledUpload = useRef<unknown>(null);

    const reachedLimit = values.length >= MAX_IMAGES;
    const isPending = uploadFetcher.state !== "idle";

    // Handle successful upload by appending the returned URL.
    useEffect(() => {
        const result = uploadFetcher.data as
            | { success: true; url: string }
            | { success: false }
            | undefined;
        if (!result || lastHandledUpload.current === result) return;
        lastHandledUpload.current = result;
        if (result.success && "url" in result) {
            onChange([...values, result.url]);
        }
    }, [uploadFetcher.data, onChange, values]);

    const onDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file || reachedLimit) return;

            const formData = new FormData();
            formData.set("intent", "uploadMedia");
            formData.set("type", "hero-extra");
            formData.set("image", file);

            uploadFetcher.submit(formData, {
                method: "post",
                action: "/app/appearance",
                encType: "multipart/form-data",
            });
        },
        [reachedLimit, uploadFetcher]
    );

    const handleDelete = useCallback(
        (url: string) => {
            const type = urlToType(url);
            const remaining = values.filter((v) => v !== url);
            onChange(remaining);
            if (!type) return;
            const formData = new FormData();
            formData.set("intent", "deleteMedia");
            formData.set("type", type);
            deleteFetcher.submit(formData, {
                method: "post",
                action: "/app/appearance",
            });
        },
        [deleteFetcher, onChange, values]
    );

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: imageAccept,
        maxFiles: 1,
        disabled: isPending || reachedLimit,
    });

    const errorMessage = getUploadErrorMessage(uploadFetcher.data);

    return (
        <div className={styles.field}>
            <s-text font-weight="semibold">{label}</s-text>

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

function getUploadErrorMessage(data: unknown): string | null {
    if (!data) return null;
    const d = data as { success?: boolean; error?: string };
    if (d.success === false && d.error) return d.error;
    return null;
}
