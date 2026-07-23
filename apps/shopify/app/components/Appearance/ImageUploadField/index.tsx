import { isValidUrl } from "@frak-labs/app-essentials";
import {
    ACCEPTED_IMAGE_TYPES,
    imageValidationMessage,
    validateImageFile,
} from "app/utils/imageValidation";
import {
    useCallback,
    useEffect,
    useId,
    useMemo,
    useRef,
    useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

type MediaFile = { type: string; url: string };

type ImageUploadFieldProps = {
    type: "logo" | "hero";
    value: string;
    onChange: (value: string) => void;
    onUploadSuccess: (url: string) => void;
    /**
     * Called when the merchant removes the current image, with the URL that
     * was cleared, so the parent can defer the storage delete until Save.
     */
    onRemove?: (previousUrl: string) => void;
    label: string;
    placeholder?: string;
    mediaFiles?: MediaFile[];
    // Externally-supplied field error (e.g. a save-time validation failure);
    // takes precedence over the live URL-format check.
    error?: string;
};

const acceptAttr = ACCEPTED_IMAGE_TYPES.join(",");

export function ImageUploadField({
    type,
    value,
    onChange,
    onUploadSuccess,
    onRemove,
    label,
    placeholder = "https://...",
    mediaFiles,
    error,
}: ImageUploadFieldProps) {
    const { t } = useTranslation();
    const mediaFetcher = useFetcher();

    const urlError =
        value && !isValidUrl(value) ? t("common.invalidUrl") : undefined;

    // Preview the current image next to the field when it's a usable URL, so
    // the merchant can confirm it without hunting through the phone preview.
    const showThumbnail = !!value && isValidUrl(value);

    const isPending = mediaFetcher.state !== "idle";

    // Keep the latest callback without making it an effect dependency — the
    // parent recreates it on every state change, so depending on its identity
    // would re-run the effect endlessly.
    const onUploadSuccessRef = useRef(onUploadSuccess);
    useEffect(() => {
        onUploadSuccessRef.current = onUploadSuccess;
    });

    // Handle upload responses — act once per distinct fetcher result.
    // mediaFetcher.data stays truthy after an upload, so without this guard
    // the effect would re-fire (and re-trigger the parent) infinitely.
    const processedResultRef = useRef<unknown>(undefined);
    useEffect(() => {
        const result = mediaFetcher.data as
            | { success: true; url: string }
            | { success: false }
            | undefined;
        if (!result?.success) return;
        if (processedResultRef.current === mediaFetcher.data) return;
        processedResultRef.current = mediaFetcher.data;
        if ("url" in result) {
            onUploadSuccessRef.current(result.url);
        }
    }, [mediaFetcher.data]);

    const uploadFile = useCallback(
        (file: File) => {
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

    const [validationError, setValidationError] = useState<string | null>(null);
    const handleDropZoneChange = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file) return;
            const validation = validateImageFile(file);
            if (!validation.valid) {
                setValidationError(
                    imageValidationMessage(validation.reason, t)
                );
                return;
            }
            setValidationError(null);
            uploadFile(file);
        },
        [uploadFile, t]
    );

    // Removal only clears the pending reference; the storage delete is
    // replayed on Save, so Discard can still restore it until then.
    const handleClear = useCallback(() => {
        onRemove?.(value);
        onChange("");
    }, [onChange, onRemove, value]);

    const dropZoneError =
        validationError ?? resolveUploadError(mediaFetcher.data, t);
    // Only while the field still holds the just-uploaded URL — otherwise the
    // "uploaded" note would linger after a remove/Discard (mediaFetcher.data
    // stays populated).
    const isUploadSuccess =
        !!value &&
        typeof (mediaFetcher.data as { url?: string })?.url === "string" &&
        (mediaFetcher.data as { url: string }).url === value;

    return (
        <s-stack gap="small">
            {/* `accessory` slot doesn't fire onClick in the App Home embed, so
                remove is a sibling button; conditional columns keep the input
                full-width and add a leading thumbnail column when set. */}
            <s-grid
                gridTemplateColumns={
                    showThumbnail ? "auto 1fr auto" : value ? "1fr auto" : "1fr"
                }
                gap="small"
                alignItems="end"
            >
                {showThumbnail && (
                    <s-thumbnail src={value} alt={label} size="base" />
                )}
                <s-text-field
                    label={label}
                    placeholder={placeholder}
                    value={value}
                    error={error ?? urlError}
                    onChange={(e) => onChange(e.currentTarget.value ?? "")}
                    autocomplete="off"
                />
                {value && (
                    <s-button
                        variant="tertiary"
                        icon="delete"
                        accessibilityLabel={t("common.removeImage")}
                        onClick={handleClear}
                    />
                )}
            </s-grid>

            {/* Cast at the boundary: @shopify/ui-extensions augments this tag
                without `.files`, but the runtime element is App Home's
                DropZone, which exposes it. Its built-in "Accepts .png, ..."
                caption stays English (no caption/slot prop, Shadow DOM) — the
                localized `<s-text>` sibling below carries that info instead. */}
            <s-drop-zone
                label={t("appearance.upload.dropzoneLabel")}
                accept={acceptAttr}
                error={dropZoneError ?? undefined}
                disabled={isPending || undefined}
                onChange={(e) => {
                    const target = e.currentTarget as unknown as {
                        files: File[];
                    };
                    handleDropZoneChange(Array.from(target.files ?? []));
                }}
            />

            <s-text color="subdued">
                {t(`appearance.upload.restrictions.${type}`)}
            </s-text>
            {isUploadSuccess && (
                <s-text tone="success">{t("common.imageUploaded")}</s-text>
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
        </s-stack>
    );
}

function resolveUploadError(
    data: unknown,
    t: (key: string) => string
): string | null {
    if (data === undefined || data === null) return null;
    if (typeof data === "object") {
        const d = data as { success?: boolean; error?: string };
        if (d.success === false) {
            return d.error ?? t("appearance.upload.failed");
        }
        return null;
    }
    // Non-object payload — typically a 413/502 from the SSR Lambda or an
    // upstream proxy returning HTML before the action could respond.
    return t("appearance.upload.failedLarge");
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
    const { t } = useTranslation();

    // Show files matching the same type (logo → logo, hero → hero or
    // hero-{variant}), excluding the file currently selected in the input.
    const pickableFiles = useMemo(() => {
        if (!mediaFiles?.length) return [];
        return mediaFiles.filter((f) => {
            if (f.url === currentValue) return false;
            if (type === "logo") return f.type === "logo";
            return f.type === "hero" || f.type.startsWith("hero-");
        });
    }, [mediaFiles, type, currentValue]);

    // Anchored popover (not inline expand) so opening it doesn't shift the
    // sections below. Open/close is declarative command/commandFor; each
    // thumbnail also uses `command="--hide"` to close on pick, since the
    // runtime polaris.js doesn't expose the typed `hideOverlay()` method.
    const popoverId = useId();

    if (!pickableFiles.length) return null;

    return (
        <s-stack direction="inline">
            <s-button
                variant="tertiary"
                icon="chevron-down"
                command="--toggle"
                commandFor={popoverId}
            >
                {t("common.useExistingImage")}
            </s-button>
            <s-popover id={popoverId}>
                <s-box padding="base">
                    <s-stack direction="inline" gap="small">
                        {pickableFiles.map((file) => (
                            <s-clickable
                                key={file.url}
                                command="--hide"
                                commandFor={popoverId}
                                onClick={() => onPick(file.url)}
                                accessibilityLabel={t("common.useImageOfType", {
                                    type: file.type,
                                })}
                            >
                                <s-thumbnail
                                    src={file.url}
                                    alt={file.type}
                                    size="base"
                                />
                            </s-clickable>
                        ))}
                    </s-stack>
                </s-box>
            </s-popover>
        </s-stack>
    );
}
