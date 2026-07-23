import { describe, expect, it } from "vitest";
import {
    ACCEPTED_IMAGE_TYPES,
    MAX_UPLOAD_BYTES,
    validateImageFile,
} from "./imageValidation";

function makeFile(name: string, type: string, sizeBytes: number): File {
    const buffer = new Uint8Array(sizeBytes);
    return new File([buffer], name, { type });
}

describe("validateImageFile", () => {
    it("accepts a valid PNG within the size limit", () => {
        const file = makeFile("logo.png", "image/png", 1024);
        expect(validateImageFile(file)).toEqual({ valid: true });
    });

    it("accepts every documented image type", () => {
        for (const type of ACCEPTED_IMAGE_TYPES) {
            const file = makeFile("image", type, 1024);
            expect(validateImageFile(file)).toEqual({ valid: true });
        }
    });

    it("rejects an unsupported file type", () => {
        const file = makeFile("doc.pdf", "application/pdf", 1024);
        const result = validateImageFile(file);
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason.code).toBe("unsupportedType");
        }
    });

    it("rejects a file larger than the 4 MB cap", () => {
        const file = makeFile("huge.png", "image/png", MAX_UPLOAD_BYTES + 1);
        const result = validateImageFile(file);
        expect(result.valid).toBe(false);
        if (!result.valid) {
            expect(result.reason.code).toBe("tooLarge");
        }
    });

    it("accepts a file exactly at the size cap", () => {
        const file = makeFile("exact.png", "image/png", MAX_UPLOAD_BYTES);
        expect(validateImageFile(file)).toEqual({ valid: true });
    });
});
