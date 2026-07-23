import {
    ACCEPTED_IMAGE_TYPES,
    imageValidationMessage,
    validateImageFile,
} from "app/utils/imageValidation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { useFetcher } from "react-router";

type MultiHeroImagesFieldProps = {
    label: string;
    values: string[];
    onChange: (values: string[]) => void;
};

const MAX_IMAGES = 4;
const acceptAttr = ACCEPTED_IMAGE_TYPES.join(",");

export function MultiHeroImagesField({
    label,
    values,
    onChange,
}: MultiHeroImagesFieldProps) {
    const { t } = useTranslation();
    const uploadFetcher = useFetcher();
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

    const uploadFile = useCallback(
        (file: File) => {
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
        [uploadFetcher]
    );

    const [validationError, setValidationError] = useState<string | null>(null);
    const handleDropZoneChange = useCallback(
        (files: File[]) => {
            const file = files[0];
            if (!file || reachedLimit) return;
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
        [reachedLimit, uploadFile, t]
    );

    // Removal only drops the pending reference; the storage delete is
    // replayed on Save.
    const handleRemove = useCallback(
        (url: string) => {
            onChange(values.filter((v) => v !== url));
        },
        [onChange, values]
    );

    const errorMessage =
        validationError ?? resolveUploadError(uploadFetcher.data, t);

    return (
        <s-stack gap="small">
            {values.length > 0 && (
                <s-stack direction="inline" gap="small">
                    {values.map((url) => (
                        <s-stack key={url} gap="small-100" alignItems="center">
                            <s-thumbnail
                                src={url}
                                alt={t("appearance.explorer.heroExtraAlt")}
                                size="base"
                            />
                            <s-button
                                variant="tertiary"
                                icon="delete"
                                accessibilityLabel={t("common.removeImage")}
                                onClick={() => handleRemove(url)}
                            />
                        </s-stack>
                    ))}
                </s-stack>
            )}

            <s-drop-zone
                label={label}
                accept={acceptAttr}
                error={errorMessage ?? undefined}
                disabled={isPending || reachedLimit || undefined}
                onChange={(e) => {
                    const target = e.currentTarget as unknown as {
                        files: File[];
                    };
                    handleDropZoneChange(Array.from(target.files ?? []));
                }}
            />
            <s-text color="subdued">
                {reachedLimit
                    ? t("appearance.explorer.heroExtrasLimitReached")
                    : t("appearance.explorer.heroExtrasRestrictions", {
                          current: values.length,
                          max: MAX_IMAGES,
                      })}
            </s-text>
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
