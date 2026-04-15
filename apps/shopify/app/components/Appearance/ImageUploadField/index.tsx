import { useCallback, useEffect, useMemo } from "react";
import { useDropzone } from "react-dropzone";
import { useFetcher } from "react-router";
import styles from "./index.module.css";

type MediaFile = { type: "logo" | "hero"; url: string };

type ImageUploadFieldProps = {
    type: "logo" | "hero";
    value: string;
    onChange: (value: string) => void;
    onUploadSuccess: (url: string) => void;
    label: string;
    placeholder?: string;
    mediaFiles?: MediaFile[];
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

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: imageAccept,
        maxFiles: 1,
        disabled: isPending,
    });

    const errorMessage = getUploadErrorMessage(mediaFetcher.data);
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

function getUploadErrorMessage(data: unknown): string | null {
    if (!data) return null;
    const d = data as { success?: boolean; error?: string };
    if (d.success === false && d.error) return d.error;
    return null;
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
    const pickableFiles = useMemo(() => {
        if (!mediaFiles?.length) return [];
        return mediaFiles.filter(
            (f) => f.type !== type && f.url !== currentValue
        );
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
