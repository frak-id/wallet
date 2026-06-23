/** Extract a displayable message from a media upload error (Eden treaty shape or Error). */
export function getUploadErrorMessage(error: unknown): string | null {
    if (!error) return null;

    if (typeof error === "object" && "value" in error) {
        const value = (error as { value: unknown }).value;
        if (value && typeof value === "object" && "error" in value) {
            return String((value as { error: unknown }).error);
        }
    }

    if (error instanceof Error) return error.message;
    return "Upload failed";
}
