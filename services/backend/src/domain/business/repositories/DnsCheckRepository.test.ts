import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import * as dns from "node:dns";
import { DnsCheckRepository } from "./DnsCheckRepository";

describe("DnsCheckRepository", () => {
    let dnsCheckRepository: DnsCheckRepository;
    const mockOwner = "0x1234567890abcdef1234567890abcdef12345678" as const;
    const resolveTxtSpy = spyOn(dns, "resolveTxt");

    beforeEach(() => {
        mock.module("@frak-labs/app-essentials", () => ({
            isRunningInProd: true,
        }));
        dnsCheckRepository = new DnsCheckRepository();
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
            // Test in non-production mode with an invalid setup code
            // Since we're not in production, it should still fall back to DNS check which returns true
            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
                setupCode:
                    "0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
            });

            // In non-production mode, this should still return true due to fallback
            expect(result).toBe(false);
        });

        it("should return true in non-production environment when no setup code", async () => {
            mock.module("@frak-labs/app-essentials", () => ({
                isRunningInProd: false,
            }));

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
            });

            expect(result).toBe(true);
        });

        it("should check DNS record when no setup code is provided", async () => {
            resolveTxtSpy.mockImplementation((_, callback) => {
                callback(null, [
                    [
                        "frak-business; hash=0x006154dba00e3da922ec9194035f0092c269285388a77a5da28f87952cfa6bab",
                    ],
                ]);
            });

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
            });

            // Should fall back to DNS check, which returns true in non-prod
            expect(resolveTxtSpy).toHaveBeenCalledWith(
                "example.com",
                expect.any(Function)
            );
            expect(result).toBe(true);
        });

        it("should check DNS record when no setup code is provided and dns is not set", async () => {
            resolveTxtSpy.mockImplementation((_, callback) => {
                callback(null, []);
            });

            const result = await dnsCheckRepository.isValidDomain({
                domain: "example.com",
                owner: mockOwner,
            });

            // Should fall back to DNS check, which returns true in non-prod
            expect(resolveTxtSpy).toHaveBeenCalledWith(
                "example.com",
                expect.any(Function)
            );
            expect(result).toBe(false);
        });
    });
});
