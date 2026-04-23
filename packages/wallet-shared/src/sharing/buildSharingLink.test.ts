import { FrakContextManager } from "@frak-labs/core-sdk";
import type { Address } from "viem";
import { describe, expect, it } from "vitest";
import { buildSharingLink } from "./buildSharingLink";

const baseUrl = "https://example.com/product";
const clientId = "550e8400-e29b-41d4-a716-446655440001";
const merchantId = "550e8400-e29b-41d4-a716-446655440000";
const wallet = "0x1234567890123456789012345678901234567890" as Address;

function parseCtx(link: string | null) {
    if (!link) return null;
    return FrakContextManager.parse({ url: link });
}

describe("buildSharingLink", () => {
    describe("null guards", () => {
        it("returns null when merchantId is missing", () => {
            expect(
                buildSharingLink({
                    clientId,
                    merchantId: undefined,
                    baseUrl,
                })
            ).toBeNull();
        });

        it("returns null when baseUrl is missing", () => {
            expect(
                buildSharingLink({
                    clientId,
                    merchantId,
                    baseUrl: undefined,
                })
            ).toBeNull();
        });

        it("returns null when both clientId and wallet are missing", () => {
            expect(
                buildSharingLink({
                    clientId: undefined,
                    merchantId,
                    baseUrl,
                })
            ).toBeNull();
        });
    });

    describe("V2 emission", () => {
        it("builds a V2 link with clientId only (anonymous sharer)", () => {
            const link = buildSharingLink({
                clientId,
                merchantId,
                baseUrl,
            });
            const ctx = parseCtx(link);
            expect(ctx).toMatchObject({ v: 2, c: clientId, m: merchantId });
            expect(ctx).not.toHaveProperty("w");
        });

        it("builds a V2 link with wallet only (authenticated sharer, no clientId)", () => {
            const link = buildSharingLink({
                clientId: undefined,
                merchantId,
                wallet,
                baseUrl,
            });
            const ctx = parseCtx(link);
            expect(ctx).toMatchObject({ v: 2, w: wallet, m: merchantId });
            expect(ctx).not.toHaveProperty("c");
        });

        it("builds a hybrid V2 link when both clientId and wallet are provided", () => {
            const link = buildSharingLink({
                clientId,
                merchantId,
                wallet,
                baseUrl,
            });
            const ctx = parseCtx(link);
            expect(ctx).toMatchObject({
                v: 2,
                c: clientId,
                w: wallet,
                m: merchantId,
            });
        });
    });

    describe("attribution", () => {
        it("applies per-call attribution overrides", () => {
            const link = buildSharingLink({
                clientId,
                merchantId,
                baseUrl,
                attribution: { utmSource: "newsletter", utmMedium: "email" },
            });
            const url = new URL(link!);
            expect(url.searchParams.get("utm_source")).toBe("newsletter");
            expect(url.searchParams.get("utm_medium")).toBe("email");
        });

        it("falls back to defaultAttribution when per-call is absent", () => {
            const link = buildSharingLink({
                clientId,
                merchantId,
                baseUrl,
                defaultAttribution: { utmSource: "merchant-default" },
            });
            const url = new URL(link!);
            expect(url.searchParams.get("utm_source")).toBe("merchant-default");
        });

        it("product-level utmContent wins over defaults", () => {
            const link = buildSharingLink({
                clientId,
                merchantId,
                baseUrl,
                productUtmContent: "product-slug",
            });
            expect(new URL(link!).searchParams.get("utm_content")).toBe(
                "product-slug"
            );
        });

        it("does not embed wallet into the `ref` UTM (privacy)", () => {
            const link = buildSharingLink({
                clientId: undefined,
                merchantId,
                wallet,
                baseUrl,
            });
            const url = new URL(link!);
            // No clientId → no `ref`; wallet MUST NOT leak into UTMs
            expect(url.searchParams.get("ref")).toBeNull();
            expect(url.searchParams.get("ref")).not.toBe(wallet);
        });
    });
});
