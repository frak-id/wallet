import type { Address } from "viem";
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

    test("returns short input untouched instead of throwing", () => {
        // viem's `slice` throws SliceOffsetOutOfBoundsError below 7 bytes.
        // These screens render backend-supplied values, so degrade instead of
        // blowing up mid-render.
        expect(shortenAddress("0x1234" as Address)).toBe("0x1234");
        expect(shortenAddress("0x" as Address)).toBe("0x");
    });
});
