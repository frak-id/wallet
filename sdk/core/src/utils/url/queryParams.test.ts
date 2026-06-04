import { describe, expect, it } from "../../../tests/vitest-fixtures";
import {
    deleteQueryParamCaseInsensitive,
    getQueryParamCaseInsensitive,
} from "./queryParams";

describe("getQueryParamCaseInsensitive", () => {
    it("reads an exact-case key", () => {
        const params = new URLSearchParams("frakAction=share");
        expect(getQueryParamCaseInsensitive(params, "frakAction")).toBe(
            "share"
        );
    });

    it("reads a fully lowercased key (email/browser mangling)", () => {
        const params = new URLSearchParams("frakaction=share");
        expect(getQueryParamCaseInsensitive(params, "frakAction")).toBe(
            "share"
        );
    });

    it("reads an uppercased key", () => {
        const params = new URLSearchParams("FRAKACTION=share");
        expect(getQueryParamCaseInsensitive(params, "frakAction")).toBe(
            "share"
        );
    });

    it("reads a mixed-case key regardless of the lookup casing", () => {
        const params = new URLSearchParams("FrAkAcTiOn=share");
        expect(getQueryParamCaseInsensitive(params, "FRAKACTION")).toBe(
            "share"
        );
    });

    it("returns null when no key matches", () => {
        const params = new URLSearchParams("other=1");
        expect(getQueryParamCaseInsensitive(params, "frakAction")).toBeNull();
    });

    it("prefers the exact-case key over a case-folded duplicate", () => {
        const params = new URLSearchParams("fctx=stale&fCtx=canonical");
        expect(getQueryParamCaseInsensitive(params, "fCtx")).toBe("canonical");
    });

    it("falls back to the first case-folded variant when no exact match", () => {
        const params = new URLSearchParams("fctx=first&FCTX=second");
        expect(getQueryParamCaseInsensitive(params, "fCtx")).toBe("first");
    });

    it("preserves the value casing (only the key is normalized)", () => {
        const params = new URLSearchParams("placement=Klaviyo-Post-Purchase");
        expect(getQueryParamCaseInsensitive(params, "PLACEMENT")).toBe(
            "Klaviyo-Post-Purchase"
        );
    });
});

describe("deleteQueryParamCaseInsensitive", () => {
    it("deletes an exact-case key", () => {
        const params = new URLSearchParams("frakAction=share&keep=me");
        deleteQueryParamCaseInsensitive(params, "frakAction");
        expect(params.toString()).toBe("keep=me");
    });

    it("deletes a lowercased key", () => {
        const params = new URLSearchParams("frakaction=share&keep=me");
        deleteQueryParamCaseInsensitive(params, "frakAction");
        expect(params.toString()).toBe("keep=me");
    });

    it("deletes every case variant of the key", () => {
        const params = new URLSearchParams(
            "frakAction=a&frakaction=b&FRAKACTION=c&keep=me"
        );
        deleteQueryParamCaseInsensitive(params, "frakAction");
        expect(params.toString()).toBe("keep=me");
    });

    it("is a no-op when the key is absent", () => {
        const params = new URLSearchParams("keep=me");
        deleteQueryParamCaseInsensitive(params, "frakAction");
        expect(params.toString()).toBe("keep=me");
    });
});
