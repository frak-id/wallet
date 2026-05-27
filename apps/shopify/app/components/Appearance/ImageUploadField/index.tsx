import { useCallback, useEffect, useMemo } from "react";
import { type FileRejection, useDropzone } from "react-dropzone";
import { useFetcher } from "react-router";
import styles from "./index.module.css";

type MediaFile = { type: string; url: string };

type ImageUploadFieldProps = {
    type: "logo" | "hero";
    value: string;
    onChange: (value: string) => void;
    onUploadSuccess: (url: string) => void;
    label: string;
    placeholder?: string;
    mediaFiles?: MediaFile[];
};

// 4 MB cap — the SSR Lambda Function URL (sst.aws.React in infra/shopify.ts)
// hard-caps request payloads at 6 MB and base64-encodes binary content (~33%
// overhead), so the effective ceiling is ~4.5 MB. Larger uploads return an
// opaque 413 from Lambda before the action runs; do not raise this without
// switching to a direct-to-backend or pre-signed-URL flow.
const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

const imageAccept = {
    "image/png": [".png"],
    "image/jpeg": [".jpg", ".jpeg"],
    "image/webp": [".webp"],
    "image/svg+xml": [".svg"],
    "image/gif": [".gif"],
};

const restrictionsText = {
    logo: "PNG, JPEG, WebP, SVG, GIF — Min 128×128px — Ratio 1:2 to 2:1 — Max 4MB",
    hero: "PNG, JPEG, WebP, SVG, GIF — Min 800×450px — Ratio 4:3 to 2:1 — Max 4MB",
} as const;

export function ImageUploadField({
    type,
    value,
    onChange,
    onUploadSuccess,
    label,
    placeholder = "https://...",
    mediaFiles,
}: ImageUploadFieldProps) {
    const mediaFetcher = useFetcher();

    const isPending = mediaFetcher.state !== "idle";

    // Handle media operation responses
    useEffect(() => {
        const result = mediaFetcher.data as
            | { success: true; url: string }
            | { success: true; deleted: true }
            | { success: false }
            | undefined;
        if (!result?.success) return;
        if ("url" in result) {
            onUploadSuccess(result.url);
        } else if ("deleted" in result) {
            onUploadSuccess("");
        }
    }, [mediaFetcher.data, onUploadSuccess]);

    const onDrop = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file) return;

            const formData = new FormData();
            formData.set("intent", "uploadMedia");
            formData.set("type", type);
            formData.set("image", file);

            mediaFetcher.submit(formData, {
                method: "post",
                action: "/app/appearance",
                encType: "multipart/form-data",
            });
        },
        [type, mediaFetcher]
    );

    const handleClear = useCallback(() => {
        const formData = new FormData();
        formData.set("intent", "deleteMedia");
        formData.set("type", type);

        mediaFetcher.submit(formData, {
            method: "post",
            action: "/app/appearance",
        });
    }, [type, mediaFetcher]);

    const { getRootProps, getInputProps, isDragActive, fileRejections } =
        useDropzone({
            onDrop,
            accept: imageAccept,
            maxFiles: 1,
            maxSize: MAX_UPLOAD_BYTES,
            disabled: isPending,
        });

    const errorMessage = resolveUploadError(fileRejections, mediaFetcher.data);
    const isUploadSuccess =
        mediaFetcher.data &&
        (mediaFetcher.data as { success: boolean }).success &&
        "url" in (mediaFetcher.data as object);

    return (
        <div className={styles.imageUploadField}>
            <div className={styles.controls}>
                <div className={styles.inputRow}>
                    <div className={styles.inputWrapper}>
                        <s-text-field
                            label={label}
                            placeholder={placeholder}
                            value={value}
                            onChange={(e) =>
                                onChange(e.currentTarget.value ?? "")
                            }
                            autocomplete="off"
                        />
                    </div>
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
                {isUploadSuccess && (
                    <p className={styles.success}>Image uploaded</p>
                )}
                <ExistingFilePicker
                    type={type}
                    currentValue={value}
                    mediaFiles={mediaFiles}
                    onPick={(url) => {
                        onChange(url);
                        onUploadSuccess(url);
                    }}
                />
            </div>
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

function ExistingFilePicker({
    type,
    currentValue,
    mediaFiles,
    onPick,
}: {
    type: "logo" | "hero";
    currentValue: string;
    mediaFiles?: MediaFile[];
    onPick: (url: string) => void;
}) {
    // Show files matching the same type (logo → logo, hero → hero or hero-{variant}),
    // excluding the file currently selected in the input.
    const pickableFiles = useMemo(() => {
        if (!mediaFiles?.length) return [];
        return mediaFiles.filter((f) => {
            if (f.url === currentValue) return false;
            if (type === "logo") return f.type === "logo";
            return f.type === "hero" || f.type.startsWith("hero-");
        });
    }, [mediaFiles, type, currentValue]);

    if (!pickableFiles.length) return null;

    return (
        <div className={styles.existingFiles}>
            <p className={styles.existingFilesLabel}>Use an existing image:</p>
            <div className={styles.existingFilesList}>
                {pickableFiles.map((file) => (
                    <button
                        key={file.url}
                        type="button"
                        className={styles.existingFileButton}
                        onClick={() => onPick(file.url)}
                        title={`Use ${file.type} image`}
                    >
                        <img src={file.url} alt={file.type} loading="lazy" />
                    </button>
                ))}
            </div>
        </div>
    );
}
