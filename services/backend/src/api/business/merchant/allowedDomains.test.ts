import { Elysia } from "elysia";
import { describe, expect, it, vi } from "vitest";

const MERCHANT_ID = "9c8b3e2a-1d4f-4a6b-8e2d-7f3a1b5c9d0e";
const OTHER_MERCHANT_ID = "1a2b3c4d-5e6f-4a8b-9c0d-1e2f3a4b5c6d";

const findByDomain = vi.fn();
const findByAllowedDomain = vi.fn();
const addAllowedDomain = vi.fn();

vi.mock("../../../domain/merchant", () => ({
    MerchantContext: {
        repositories: {
            merchant: {
                findByDomain: (...args: unknown[]) => findByDomain(...args),
                findByAllowedDomain: (...args: unknown[]) =>
                    findByAllowedDomain(...args),
                addAllowedDomain: (...args: unknown[]) =>
                    addAllowedDomain(...args),
            },
            dnsCheck: {
                // Enough of the real normalization to exercise the route.
                getNormalizedDomain: (domain: string) =>
                    domain
                        .trim()
                        .toLowerCase()
                        .replace(/^https?:\/\//, "")
                        .replace(/\/$/, "")
                        .replace("www.", ""),
            },
        },
        services: { resolve: { invalidateForMerchant: vi.fn() } },
    },
}));

// The session macro is auth, not the behaviour under test.
vi.mock("../middleware/session", () => ({
    businessSessionContext: new Elysia({ name: "test-session" }).macro({
        requireMerchantAccess: () => ({}),
    }),
}));

import { merchantAllowedDomainsRoutes } from "./allowedDomains";

function addDomain(domain: string) {
    return merchantAllowedDomainsRoutes.handle(
        new Request(`http://localhost/${MERCHANT_ID}/allowed-domains`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ domain }),
        })
    );
}

describe("POST /:merchantId/allowed-domains", () => {
    it("rejects a domain already claimed by another merchant", async () => {
        findByDomain.mockResolvedValue({ id: OTHER_MERCHANT_ID });

        const response = await addDomain("example.com");

        expect(response.status).toBe(409);
        expect((await response.json()).code).toBe("DOMAIN_ALREADY_CLAIMED");
        expect(addAllowedDomain).not.toHaveBeenCalled();
    });

    it("rejects a domain held as an allowed domain of another merchant", async () => {
        findByDomain.mockResolvedValue(null);
        findByAllowedDomain.mockResolvedValue({ id: OTHER_MERCHANT_ID });

        const response = await addDomain("example.com");

        expect(response.status).toBe(409);
        expect(addAllowedDomain).not.toHaveBeenCalled();
    });

    it("allows re-adding a domain the caller already holds", async () => {
        findByDomain.mockResolvedValue(null);
        findByAllowedDomain.mockResolvedValue({ id: MERCHANT_ID });
        addAllowedDomain.mockResolvedValue({ id: MERCHANT_ID, domain: "x" });

        // Not asserting 204: a bare `.handle()` cannot construct a bodyless
        // response, so the status is an artifact of the harness. What matters
        // is that the write was reached rather than short-circuited by 409.
        await addDomain("example.com");

        expect(addAllowedDomain).toHaveBeenCalledWith(
            MERCHANT_ID,
            "example.com"
        );
    });

    it("checks the claim against the normalized domain, not the raw input", async () => {
        findByDomain.mockResolvedValue(null);
        findByAllowedDomain.mockResolvedValue(null);
        addAllowedDomain.mockResolvedValue({ id: MERCHANT_ID, domain: "x" });

        await addDomain("  https://www.Example.com/  ");

        expect(findByDomain).toHaveBeenCalledWith("example.com");
        expect(addAllowedDomain).toHaveBeenCalledWith(
            MERCHANT_ID,
            "example.com"
        );
    });
});
