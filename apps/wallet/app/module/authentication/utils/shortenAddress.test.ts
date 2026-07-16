import { describe, expect, test } from "vitest";
import { shortenAddress } from "./shortenAddress";

describe("shortenAddress", () => {
    test("truncates a normal 0x address to start...end form", () => {
        expect(
            shortenAddress("0x1234567890abcdef1234567890abcdef12345678")
        ).toBe("0x123456...12345678");
    });

    test("handles the all-zero-prefixed edge address without throwing", () => {
        expect(
            shortenAddress("0x00000000000000000000000000000000000000ab")
        ).toBe("0x000000...000000ab");
    });
});
