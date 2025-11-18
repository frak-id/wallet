import { beforeEach, describe, expect, it, vi } from "vitest";
import { DnsCheckRepository } from "./DnsCheckRepository";

// Mock the dns module using vi.hoisted to ensure proper hoisting
const { mockResolveTxt, mockIsRunningInProd } = vi.hoisted(() => ({
    mockResolveTxt: vi.fn(),
    mockIsRunningInProd: { value: true },
}));

vi.mock("node:dns", () => ({
    resolveTxt: mockResolveTxt,
}));

// Mock app-essentials with a getter so we can change it per test
vi.mock("@frak-labs/app-essentials", () => ({
    get isRunningInProd() {
        return mockIsRunningInProd.value;
    },
}));

describe("DnsCheckRepository", () => {
    let dnsCheckRepository: DnsCheckRepository;
    const mockOwner = "0x1234567890abcdef1234567890abcdef12345678" as const;

    beforeEach(() => {
        dnsCheckRepository = new DnsCheckRepository();
        mockResolveTxt.mockClear();
        // Reset to production mode by default
        mockIsRunningInProd.value = true;
    });

    describe("getNormalizedDomain", () => {
        it("should normalize domain with https prefix", () => {
            const result = dnsCheckRepository.getNormalizedDomain(
                "https://www.example.com"
            );
            expect(result).toBe("example.com");
        });

        it("should normalize domain without https prefix", () => {
            const result =
                dnsCheckRepository.getNormalizedDomain("www.example.com");
            expect(result).toBe("example.com");
        });

        it("should handle domain without www", () => {
            const result =
                dnsCheckRepository.getNormalizedDomain("example.com");
            expect(result).toBe("example.com");
        });

        it("should handle subdomain", () => {
            const result = dnsCheckRepository.getNormalizedDomain(
                "https://subdomain.example.com"
            );
            expect(result).toBe("subdomain.example.com");
        });

        it("should handle complex domain with path", () => {
            const result = dnsCheckRepository.getNormalizedDomain(
                "https://www.example.com/path/to/page"
            );
            expect(result).toBe("example.com");
        });
    });

    describe("getDnsTxtString", () => {
        it("should generate correct DNS TXT string", () => {
            const domain = "example.com";
            const result = dnsCheckRepository.getDnsTxtString({
                domain,
                owner: mockOwner,
            });

            expect(result).toMatch(/^frak-business; hash=0x[a-f0-9]{64}$/);
        });

        it("should normalize domain before generating hash", () => {
            const result1 = dnsCheckRepository.getDnsTxtString({
                domain: "https://www.example.com",
                owner: mockOwner,
            });
            const result2 = dnsCheckRepository.getDnsTxtString({
                domain: "example.com",
                owner: mockOwner,
            });

            expect(result1).toBe(result2);
        });

        it("should generate different hashes for different owners", () => {
            const domain = "example.com";
            const owner2 =
                "0xabcdefabcdefabcdefabcdefabcdefabcdefabcd" as const;

            const result1 = dnsCheckRepository.getDnsTxtString({
                domain,
                owner: mockOwner,
            });
            const result2 = dnsCheckRepository.getDnsTxtString({
                domain,
                owner: owner2,
            });

            expect(result1).not.toBe(result2);
        });
    });

    describe("isValidDomain", () => {
        it("should return true when valid setup code is provided", async () => {
            // Mock environment variable
            process.env.PRODUCT_SETUP_CODE_SALT = "test-salt";

            // We need to calculate what the setup code should be for our test
            const { keccak256, concatHex, toHex } = await import("viem");
            const domain = "example.com";
            const hash = keccak256(
                concatHex([toHex(domain), mockOwner, toHex("test-salt")])
            );

            const result = await dnsCheckRepository.isValidDomain({
                domain,
                owner: mockOwner,
                setupCode: hash,
            });

            expect(result).toBe(true);
        });

        it("should return false when invalid setup code is provided", async () => {
            // Mock DNS to return no records so it returns false
            mockResolveTxt.mockImplementation((_, callback) => {
                callback(null, []);
            });

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
                setupCode:
                    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            });

            // Invalid setup code should fall back to DNS check, which returns false (no records)
            expect(result).toBe(false);
        });

        it("should return true in non-production environment when no setup code", async () => {
            // Set to non-production mode
            mockIsRunningInProd.value = false;

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
            });

            expect(result).toBe(true);
        });

        it("should check DNS record when no setup code is provided", async () => {
            // Ensure we're in production mode so DNS check is actually called
            mockIsRunningInProd.value = true;

            // Generate the correct DNS TXT record for this domain and owner
            const expectedTxtRecord = dnsCheckRepository.getDnsTxtString({
                domain: "example.com",
                owner: mockOwner,
            });

            mockResolveTxt.mockImplementation((_, callback) => {
                callback(null, [[expectedTxtRecord]]);
            });

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
            });

            // Should call DNS check in production mode
            expect(mockResolveTxt).toHaveBeenCalledWith(
                "example.com",
                expect.any(Function)
            );
            expect(result).toBe(true);
        });

        it("should check DNS record when no setup code is provided and dns is not set", async () => {
            // Ensure we're in production mode so DNS check is actually called
            mockIsRunningInProd.value = true;

            mockResolveTxt.mockImplementation((_, callback) => {
                callback(null, []);
            });

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
            });

            // Should call DNS check in production mode
            expect(mockResolveTxt).toHaveBeenCalledWith(
                "example.com",
                expect.any(Function)
            );
            expect(result).toBe(false);
        });
    });
});
