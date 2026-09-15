import { describe, expect, test } from "vitest";
import { extractDomain } from "./extractDomain";

describe("extractDomain", () => {
    test("extracts the host from an origin", () => {
        expect(extractDomain("https://example.com")).toBe("example.com");
        expect(extractDomain("https://example.com/path?q=1")).toBe(
            "example.com"
        );
    });

    test("keeps the port, which distinguishes origins", () => {
        expect(extractDomain("http://localhost:3000")).toBe("localhost:3000");
    });

    test("strips a leading www.", () => {
        expect(extractDomain("https://www.example.com")).toBe("example.com");
    });

    test("only strips www. when it is the leading label", () => {
        // The previous unanchored `replace("www.", "")` rewrote this to
        // `foo.example.com`, which silently widens any allow-list built on it.
        expect(extractDomain("https://foo.www.example.com")).toBe(
            "foo.www.example.com"
        );
        expect(extractDomain("https://wwwx.example.com")).toBe(
            "wwwx.example.com"
        );
    });

    test("returns null for unparseable input so callers fail closed", () => {
        expect(extractDomain("not-a-url")).toBeNull();
        expect(extractDomain("")).toBeNull();
    });
});
