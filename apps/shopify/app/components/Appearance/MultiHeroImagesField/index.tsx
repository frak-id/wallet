import { useCallback, useEffect, useRef, useState } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { useFetcher } from "react-router";
import styles from "./index.module.css";

type MultiHeroImagesFieldProps = {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
};

const MAX_IMAGES = 4;

// 4 MB cap — matches ImageUploadField. The SSR Lambda Function URL hard-caps
// payloads at 6 MB with base64 encoding (~33% overhead). Larger uploads return
// an opaque 413 from Lambda before the action runs.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const imageAccept = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"],
};

const restrictionsText =
    "PNG, JPEG, WebP, SVG, GIF — Min 800×450px — Ratio 4:3 to 2:1 — Max 4MB";

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

    const { getRootProps, getInputProps, isDragActive, fileRejections } =
        useDropzone({
            onDrop,
            accept: imageAccept,
            maxFiles: 1,
            maxSize: MAX_UPLOAD_BYTES,
            disabled: isPending || reachedLimit,
        });

    const errorMessage = resolveUploadError(fileRejections, uploadFetcher.data);

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

function resolveUploadError(
    rejections: readonly FileRejection[],
    data: unknown
): string | null {
    const rejection = rejections[0];
    if (rejection) return describeRejection(rejection);
    return describeServerError(data);
}

function describeRejection(rejection: FileRejection): string {
    const error = rejection.errors[0];
    if (!error) return "File rejected.";
    switch (error.code) {
        case "file-too-large":
            return `${rejection.file.name} is ${formatMb(rejection.file.size)} — images must stay under ${formatMb(MAX_UPLOAD_BYTES)}.`;
        case "file-invalid-type":
            return `${rejection.file.name} is not a supported image format (PNG, JPEG, WebP, SVG, GIF).`;
        case "too-many-files":
            return "Please upload one image at a time.";
        default:
            return error.message || "File rejected.";
    }
}

function describeServerError(data: unknown): string | null {
    if (data === undefined || data === null) return null;
    if (typeof data === "object") {
        const d = data as { success?: boolean; error?: string };
        if (d.success === false) {
            return d.error ?? "Upload failed. Please try again.";
        }
        return null;
    }
    // Non-object payload — typically a 413/502 from the SSR Lambda or an
    // upstream proxy returning HTML before the action could respond.
    return "Upload failed. The image may be too large or the network was interrupted.";
}

function formatMb(bytes: number): string {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
