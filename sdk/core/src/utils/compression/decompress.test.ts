import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { base64urlEncode } from "./b64";
import { compressJsonToB64 } from "./compress";
import { decompressJsonFromB64 } from "./decompress";

describe("decompressJsonFromB64", () => {
    it("should round-trip a nested payload", () => {
        const original = {
            id: 123,
            name: "Test User",
            tags: ["tag1", "tag2"],
            metadata: { created: "2024-01-01" },
        };

        const decompressed = decompressJsonFromB64<typeof original>(
            compressJsonToB64(original)
        );

        expect(decompressed).toEqual(original);
    });

    it("should return null when the payload is not JSON", () => {
        const notJson = base64urlEncode(new TextEncoder().encode("not json"));

        expect(decompressJsonFromB64(notJson)).toBeNull();
    });
});
