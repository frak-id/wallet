import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";

import { getUploadErrorMessage } from "./uploadError";

/** Echoes the key back so assertions can name the expected translation. */
const t = ((key: string) => key) as unknown as TFunction;

/**
 * Eden throws an Error subclass whose `message` is the stringified response
 * body, so a non-string body yields "[object Object]".
 */
function edenError(status: number, value: unknown) {
    const error = new Error(String(value));
    return Object.assign(error, { status, value });
}

/** Elysia rejects an over-maxSize file before the route runs. */
const fileValidationBody = {
    type: "validation",
    on: "body",
    property: "/image",
    message: "Expected kind 'File'",
    summary: "Expected kind 'File'",
};

describe("getUploadErrorMessage", () => {
    it("returns null without an error", () => {
        expect(getUploadErrorMessage(null)).toBeNull();
        expect(getUploadErrorMessage(undefined)).toBeNull();
    });

    it("surfaces the message from an HttpError body", () => {
        const error = edenError(409, {
            success: false,
            code: "DUPLICATE_IMAGE",
            error: "This image is already uploaded",
        });

        expect(getUploadErrorMessage(error, t)).toBe(
            "This image is already uploaded"
        );
    });

    it("translates a rejected file instead of echoing the schema text", () => {
        const error = edenError(422, fileValidationBody);

        expect(getUploadErrorMessage(error, t)).toBe(
            "merchantEdit.explorer.errors.fileRejected"
        );
    });

    it("never leaks a stringified object", () => {
        const error = edenError(422, fileValidationBody);

        expect(error.message).toBe("[object Object]");
        expect(getUploadErrorMessage(error, t)).not.toContain("[object");
        expect(getUploadErrorMessage(error)).not.toContain("[object");
    });

    it("translates regardless of which body field the schema names", () => {
        // The backend owns the field name; renaming `image` must not drop us
        // back to raw schema text.
        const error = edenError(422, {
            ...fileValidationBody,
            property: "/renamedFile",
        });

        expect(getUploadErrorMessage(error, t)).toBe(
            "merchantEdit.explorer.errors.fileRejected"
        );
    });

    it("passes through a validation failure outside the body", () => {
        const error = edenError(422, {
            type: "validation",
            on: "params",
            property: "/merchantId",
            message: "Expected string",
        });

        expect(getUploadErrorMessage(error, t)).toBe("Expected string");
    });

    it("reads a plain-text body", () => {
        expect(getUploadErrorMessage(edenError(401, "Unauthorized"), t)).toBe(
            "Unauthorized"
        );
    });

    it("keeps a plain Error message", () => {
        expect(getUploadErrorMessage(new Error("Network down"), t)).toBe(
            "Network down"
        );
    });

    it("falls back when nothing usable is present", () => {
        expect(getUploadErrorMessage({ status: 500, value: {} }, t)).toBe(
            "merchantEdit.explorer.errors.uploadFailed"
        );
    });

    it("still returns something readable without a translator", () => {
        const message = getUploadErrorMessage(
            edenError(422, fileValidationBody)
        );

        expect(message).toBeTruthy();
        expect(message).not.toContain("[object");
        expect(message).not.toContain("merchantEdit.");
    });
});
