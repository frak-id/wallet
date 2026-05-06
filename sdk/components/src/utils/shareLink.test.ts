import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    buildShareLinkUrl,
    FRAK_ACTION_KEY,
    FRAK_DATA_KEY,
    parseShareLinkPayload,
    type ShareLinkPayload,
} from "./shareLink";

describe("shareLink", () => {
    describe("buildShareLinkUrl", () => {
        it("returns a URL with frakAction=share when no payload is provided", () => {
            const url = buildShareLinkUrl({ baseUrl: "https://acme.com" });
            const parsed = new URL(url);

            expect(parsed.searchParams.get(FRAK_ACTION_KEY)).toBe("share");
            expect(parsed.searchParams.get(FRAK_DATA_KEY)).toBeNull();
        });

        it("encodes the payload into frakData when provided", () => {
            const payload: ShareLinkPayload = {
                link: "https://acme.com/product/red",
                products: [{ title: "Red shirt" }],
            };

            const url = buildShareLinkUrl({
                baseUrl: "https://acme.com",
                payload,
            });
            const parsed = new URL(url);

            expect(parsed.searchParams.get(FRAK_ACTION_KEY)).toBe("share");
            const frakData = parsed.searchParams.get(FRAK_DATA_KEY);
            expect(frakData).toBeTruthy();
            // base64url alphabet: A-Z a-z 0-9 - _
            expect(frakData).toMatch(/^[A-Za-z0-9_-]+$/);
        });

        it("omits frakData for an empty payload object", () => {
            const url = buildShareLinkUrl({
                baseUrl: "https://acme.com",
                payload: {},
            });
            const parsed = new URL(url);

            expect(parsed.searchParams.get(FRAK_DATA_KEY)).toBeNull();
        });

        it("omits frakData when only undefined fields are present", () => {
            const url = buildShareLinkUrl({
                baseUrl: "https://acme.com",
                payload: {
                    link: undefined,
                    products: [],
                    targetInteraction: undefined,
                },
            });
            const parsed = new URL(url);

            expect(parsed.searchParams.get(FRAK_DATA_KEY)).toBeNull();
        });

        it("preserves an existing path on the base URL", () => {
            const url = buildShareLinkUrl({
                baseUrl: "https://acme.com/landing",
            });
            const parsed = new URL(url);

            expect(parsed.pathname).toBe("/landing");
            expect(parsed.searchParams.get(FRAK_ACTION_KEY)).toBe("share");
        });

        it("strips stale frakData from a recycled URL when payload is empty", () => {
            const recycled = `https://acme.com/?${FRAK_DATA_KEY}=stale`;

            const url = buildShareLinkUrl({ baseUrl: recycled });
            const parsed = new URL(url);

            expect(parsed.searchParams.get(FRAK_DATA_KEY)).toBeNull();
            expect(parsed.searchParams.get(FRAK_ACTION_KEY)).toBe("share");
        });
    });

    describe("parseShareLinkPayload", () => {
        let consoleWarnSpy: ReturnType<typeof vi.spyOn>;

        beforeEach(() => {
            consoleWarnSpy = vi
                .spyOn(console, "warn")
                .mockImplementation(() => {});
        });

        afterEach(() => {
            consoleWarnSpy.mockRestore();
        });

        it("returns null when the search string is empty", () => {
            expect(parseShareLinkPayload("")).toBeNull();
        });

        it("returns null when frakData is absent", () => {
            expect(parseShareLinkPayload("?frakAction=share")).toBeNull();
        });

        it("decodes a payload produced by buildShareLinkUrl (round-trip)", () => {
            const payload: ShareLinkPayload = {
                link: "https://acme.com/product/red",
                products: [
                    { title: "Red shirt", imageUrl: "https://acme.com/r.png" },
                ],
                targetInteraction: "create_referral_link",
            };

            const url = buildShareLinkUrl({
                baseUrl: "https://acme.com",
                payload,
            });
            const decoded = parseShareLinkPayload(new URL(url).search);

            expect(decoded).toEqual(payload);
        });

        it("returns null and warns on a malformed frakData value", () => {
            const decoded = parseShareLinkPayload(
                `?${FRAK_DATA_KEY}=this-is-not-base64url-json`
            );

            expect(decoded).toBeNull();
        });
    });
});
