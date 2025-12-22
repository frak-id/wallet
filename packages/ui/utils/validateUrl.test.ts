/**
 * Tests for validateUrl utility function
 * Tests URL validation using regex pattern
 */

import { describe, expect, it } from "vitest";
import { validateUrl } from "./validateUrl";

describe("validateUrl", () => {
    describe("valid URLs", () => {
        it("should validate URL with https protocol", () => {
            expect(validateUrl("https://example.com")).toBe(true);
        });

        it("should validate URL with http protocol", () => {
            expect(validateUrl("http://example.com")).toBe(true);
        });

        it("should validate URL without protocol", () => {
            expect(validateUrl("example.com")).toBe(true);
        });

        it("should validate URL with www subdomain", () => {
            expect(validateUrl("www.example.com")).toBe(true);
        });

        it("should validate URL with https and www", () => {
            expect(validateUrl("https://www.example.com")).toBe(true);
        });

        it("should validate URL with http and www", () => {
            expect(validateUrl("http://www.example.com")).toBe(true);
        });

        it("should validate URL with trailing slash", () => {
            expect(validateUrl("https://example.com/")).toBe(true);
        });

        it("should validate URL with subdomain", () => {
            expect(validateUrl("subdomain.example.com")).toBe(true);
        });

        it("should validate URL with multiple subdomains", () => {
            expect(validateUrl("sub1.sub2.example.com")).toBe(true);
        });

        it("should validate URL with hyphens in domain", () => {
            expect(validateUrl("example-site.com")).toBe(true);
        });

        it("should validate URL with numbers in domain", () => {
            expect(validateUrl("example123.com")).toBe(true);
        });

        it("should validate URL with different TLDs", () => {
            expect(validateUrl("example.org")).toBe(true);
            expect(validateUrl("example.net")).toBe(true);
            expect(validateUrl("example.io")).toBe(true);
            expect(validateUrl("example.co.uk")).toBe(true);
        });
    });

    describe("invalid URLs", () => {
        it("should reject empty string", () => {
            expect(validateUrl("")).toBe(false);
        });

        it("should reject URL without TLD", () => {
            expect(validateUrl("example")).toBe(false);
        });

        it("should reject URL with invalid characters", () => {
            expect(validateUrl("example@.com")).toBe(false);
        });

        it("should reject URL with spaces", () => {
            expect(validateUrl("example .com")).toBe(false);
        });

        it("should reject URL with only protocol", () => {
            expect(validateUrl("https://")).toBe(false);
        });

        it("should reject URL with invalid protocol", () => {
            expect(validateUrl("ftp://example.com")).toBe(false);
        });

        it("should reject URL with path", () => {
            expect(validateUrl("https://example.com/path")).toBe(false);
        });

        it("should reject URL with query parameters", () => {
            expect(validateUrl("https://example.com?param=value")).toBe(false);
        });

        it("should reject URL with fragment", () => {
            expect(validateUrl("https://example.com#fragment")).toBe(false);
        });

        it("should reject URL with port", () => {
            expect(validateUrl("https://example.com:8080")).toBe(false);
        });

        it("should accept single character domain (regex allows it)", () => {
            // The regex pattern allows single character domains
            expect(validateUrl("a.com")).toBe(true);
        });

        it("should reject URL with invalid TLD length", () => {
            expect(validateUrl("example.c")).toBe(false);
        });

        it("should reject URL with special characters", () => {
            expect(validateUrl("example!.com")).toBe(false);
        });
    });

    describe("case sensitivity", () => {
        it("should be case insensitive", () => {
            expect(validateUrl("EXAMPLE.COM")).toBe(true);
            expect(validateUrl("Example.Com")).toBe(true);
            expect(validateUrl("ExAmPlE.cOm")).toBe(true);
        });
    });
});
