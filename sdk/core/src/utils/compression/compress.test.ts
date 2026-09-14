import { describe, expect, it } from "../../../tests/vitest-fixtures";
import { compressJsonToB64 } from "./compress";

describe("compressJsonToB64", () => {
    it("should emit a base64url string, with no padding or unsafe chars", () => {
        const result = compressJsonToB64({ key: "value", list: [1, 2, 3] });

        expect(result.length).toBeGreaterThan(0);
        expect(result).not.toMatch(/[+/=]/);
    });
});
