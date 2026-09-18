import { describe, expect, it, vi } from "vitest";
import { loaderUrl, waitFor } from "./wait-for-jsdelivr";

const URL = loaderUrl("1.2.2");
const quiet = { pollIntervalMs: 0, log: () => {} };

describe("loaderUrl", () => {
    it("targets the exact-version loader, never a floating tag", () => {
        expect(URL).toBe(
            "https://cdn.jsdelivr.net/npm/@frak-labs/components@1.2.2/cdn/loader.js"
        );
    });

    it("keeps a beta prerelease version intact", () => {
        expect(loaderUrl("1.2.2-beta.f0ed3664")).toContain(
            "@1.2.2-beta.f0ed3664/cdn/loader.js"
        );
    });
});

describe("waitFor", () => {
    it("returns once jsDelivr answers 200", async () => {
        const fetch = vi
            .fn()
            .mockResolvedValueOnce({ ok: false, status: 404 })
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ ok: true, status: 200 });

        await waitFor(URL, { ...quiet, fetch, timeoutMs: 60_000 });

        expect(fetch).toHaveBeenCalledTimes(3);
        expect(fetch).toHaveBeenCalledWith(URL);
    });

    it("throws once the deadline passes without a 200", async () => {
        const fetch = vi.fn().mockResolvedValue({ ok: false, status: 404 });

        await expect(
            waitFor(URL, { ...quiet, fetch, timeoutMs: 0 })
        ).rejects.toThrow(/never returned 200/);
        expect(fetch).toHaveBeenCalledTimes(1);
    });
});
