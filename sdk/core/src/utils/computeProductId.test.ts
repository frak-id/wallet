import { describe, expect, test } from "vitest";
import { computeProductId } from "./computeProductId";

describe("computeProductId", () => {
    test("should return domain name to Hex value", () => {
        expect(computeProductId({ domain: "test.com" })).toBe(
            "0xb708c1f6e300073b25faa047dd354a550916ad30b4929c92d1822a0595a4afde"
        );
    });

    test("should handle domains with www prefix", () => {
        expect(computeProductId({ domain: "www.test.com" })).toBe(
            "0x308128236faf4820474b9bec46513b3d4907e1eb00909d814fe5c6c7909a95d5"
        );
    });

    test("should handle domains with subdomain", () => {
        expect(computeProductId({ domain: "blog.test.com" })).toBe(
            "0x0b7eeaf6d293fdb31c02b66013a75f2102b64ad6a657659a7686b970180c912d"
        );
    });

    test("should handle domains with multiple subdomains", () => {
        expect(computeProductId({ domain: "dev.blog.test.com" })).toBe(
            "0x65c0eca3b3d03c712b0318a1f5fc1675aef346ed7d287e496897d022e7b77907"
        );
    });

    test("should handle domains with different TLDs", () => {
        expect(computeProductId({ domain: "test.org" })).toBe(
            "0x24b4936f44090a544e5dd95a7133d38901598e21f6ba62b81d9fae4980826dc8"
        );
        expect(computeProductId({ domain: "test.io" })).toBe(
            "0x24b344c3dec6f756c2d2330f1267eea30c7230d53f05584c15df4582c0e5670d"
        );
    });

    test("should handle domains with special characters", () => {
        expect(computeProductId({ domain: "test-domain.com" })).toBe(
            "0xe9c5fbd250b1bbd5503172fcd2125215dc8830be846c38efe6588bae6f8d298a"
        );
        expect(computeProductId({ domain: "test_domain.com" })).toBe(
            "0x964d0d6ee59f4a68aeee4bdc3a3e175ddfdd17b35b4df9708e8bc5ae2a3e1d86"
        );
    });

    test("should handle uppercase domains by treating them case-sensitively", () => {
        const lowercase = computeProductId({ domain: "test.com" });
        const uppercase = computeProductId({ domain: "TEST.COM" });
        expect(lowercase).not.toBe(uppercase);
        expect(uppercase).toBe(
            "0x545c8d7d6136d99a7c1536d05a12481c54b54225b2001bc0284e5a44e4746b99"
        );
    });

    test("should handle empty domain", () => {
        expect(computeProductId({ domain: "" })).toBe(
            "0xc5d2460186f7233c927e7db2dcc703c0e500b653ca82273b7bfad8045d85a470"
        );
    });

    test("should use window.location.host when domain is not provided", () => {
        // Mock window.location.host
        const originalWindow = global.window;
        global.window = {
            location: {
                host: "mocked-domain.com",
            },
        } as unknown as Window & typeof globalThis;

        expect(computeProductId({})).toBe(
            "0x47f08b07f6ece68ba0db465ed503b38b3ae70fdd76dbfeac2fb7baa9554f5110"
        );

        // Restore original window
        global.window = originalWindow;
    });

    test("should handle undefined domain by using window.location.host", () => {
        // Mock window.location.host
        const originalWindow = global.window;
        global.window = {
            location: {
                host: "fallback-domain.com",
            },
        } as unknown as Window & typeof globalThis;

        expect(computeProductId({ domain: undefined })).toBe(
            "0x63a443e49f2f2f61ea2b3934796007f84c5f198255b2f87e69ef42bf080a5333"
        );

        // Restore original window
        global.window = originalWindow;
    });
});
