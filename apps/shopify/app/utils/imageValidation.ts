/**
 * Pure image validation for the appearance upload fields. Extracted so the
 * size/type checks can be unit tested without a component-test harness.
 *
 * 4 MB cap — the SSR Lambda Function URL (sst.aws.React in infra/shopify.ts)
 * hard-caps request payloads at 6 MB and base64-encodes binary content (~33%
 * overhead), so the effective ceiling is ~4.5 MB. Larger uploads return an
 * opaque 413 from Lambda before the action runs; do not raise this without
 * switching to a direct-to-backend or pre-signed-URL flow.
 */
export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

export const ACCEPTED_IMAGE_TYPES = [
    "image/png",
    "image/jpeg",
    "image/webp",
    "image/svg+xml",
    "image/gif",
];

// Codes + interpolation values instead of hardcoded copy, so the message is
// translated at the call site (imageValidationMessage) rather than here.
export type ImageValidationError =
    | { code: "unsupportedType"; fileName: string }
    | { code: "tooLarge"; fileName: string; size: string; max: string };

export type ImageValidationResult =
    | { valid: true }
    | { valid: false; reason: ImageValidationError };

/**
 * Validate a single file against the accepted image types and the upload
 * size cap. Does not inspect file contents — only type and size.
 */
export function validateImageFile(file: File): ImageValidationResult {
    if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) {
        return {
            valid: false,
            reason: { code: "unsupportedType", fileName: file.name },
        };
    }
    if (file.size > MAX_UPLOAD_BYTES) {
        return {
            valid: false,
            reason: {
                code: "tooLarge",
                fileName: file.name,
                size: formatMb(file.size),
                max: formatMb(MAX_UPLOAD_BYTES),
            },
        };
    }
    return { valid: true };
}

/**
 * Translate a validation error into a user-facing message. Takes the i18next
 * translator so the util itself stays free of hardcoded copy.
 */
export function imageValidationMessage(
    reason: ImageValidationError,
    t: (key: string, opts?: Record<string, unknown>) => string
): string {
    if (reason.code === "unsupportedType") {
        return t("appearance.upload.validation.unsupportedType", {
            fileName: reason.fileName,
        });
    }
    return t("appearance.upload.validation.tooLarge", {
        fileName: reason.fileName,
        size: reason.size,
        max: reason.max,
    });
}

function formatMb(bytes: number): string {
    return (bytes / (1024 * 1024)).toFixed(1);
}
