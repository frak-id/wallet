import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
    getBackendUrl,
    getEnvironment,
    getWalletUrl,
    setEnvironment,
} from "./environment";

describe("environment", () => {
    beforeEach(() => {
        // Reset the module copy first, then clear the window one, so a test
        // starts from "nothing published" rather than "prod published".
        setEnvironment("prod");
        window.__frakEnv = undefined;
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("defaults to production when nothing was set", () => {
        expect(getEnvironment()).toEqual({
            wallet: "https://wallet.frak.id",
            backend: "https://backend.frak.id",
        });
    });

    it("resolves the named stages", () => {
        expect(setEnvironment("prod")).toEqual({
            wallet: "https://wallet.frak.id",
            backend: "https://backend.frak.id",
        });
        expect(setEnvironment("dev")).toEqual({
            wallet: "https://wallet-dev.frak.id",
            backend: "https://backend.gcp-dev.frak.id",
        });
    });

    it("takes a custom pair verbatim", () => {
        setEnvironment({
            wallet: "https://localhost:3000",
            backend: "https://localhost:3030",
        });

        expect(getWalletUrl()).toBe("https://localhost:3000");
        expect(getBackendUrl()).toBe("https://localhost:3030");
    });

    it("strips a trailing slash so origins don't concatenate into `//`", () => {
        setEnvironment({
            wallet: "https://localhost:3000/",
            backend: "https://localhost:3030/",
        });

        expect(getBackendUrl()).toBe("https://localhost:3030");
        expect(getWalletUrl()).toBe("https://localhost:3000");
    });

    it("collapses repeated trailing slashes, not just one", () => {
        setEnvironment({
            wallet: "https://localhost:3000//",
            backend: "https://localhost:3030//",
        });

        expect(getBackendUrl()).toBe("https://localhost:3030");
        expect(getWalletUrl()).toBe("https://localhost:3000");
    });

    it("leaves the published env alone when none is stated", () => {
        // A second client built from a bare config must not repoint the
        // first one's in-flight calls at production.
        setEnvironment("dev");

        expect(setEnvironment(undefined).backend).toBe(
            "https://backend.gcp-dev.frak.id"
        );
    });

    it("reports an unrecognised stage instead of absorbing it", () => {
        // Untyped callers (Liquid templates, pasted snippets) can send
        // anything; silently landing on production is the bug this whole
        // module replaced.
        expect(setEnvironment("staging" as never)).toEqual({
            wallet: "https://wallet.frak.id",
            backend: "https://backend.frak.id",
        });
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("refuses inherited object keys as stage names", () => {
        // A bare `PRESETS[env]` probe resolved "constructor"/"toString" to a
        // truthy non-environment, skipping the error and yielding
        // `fetch("undefined/…")` far from the cause.
        expect(setEnvironment("constructor" as never)).toEqual({
            wallet: "https://wallet.frak.id",
            backend: "https://backend.frak.id",
        });
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("reports a half-stated pair rather than serialising `undefined` into a URL", () => {
        expect(
            setEnvironment({ wallet: "https://localhost:3000" } as never)
        ).toEqual({
            wallet: "https://wallet.frak.id",
            backend: "https://backend.frak.id",
        });
        expect(console.error).toHaveBeenCalledOnce();
    });

    it("warns when a second integration publishes a different stage", () => {
        setEnvironment("dev");
        setEnvironment("prod");

        expect(console.warn).toHaveBeenCalledOnce();
    });

    it("does not warn when the same stage is republished", () => {
        setEnvironment("dev");
        setEnvironment("dev");

        expect(console.warn).not.toHaveBeenCalled();
    });

    it("publishes to window so a second bundle instance agrees on the stage", () => {
        setEnvironment("dev");

        expect(window.__frakEnv).toEqual({
            wallet: "https://wallet-dev.frak.id",
            backend: "https://backend.gcp-dev.frak.id",
        });
    });

    it("reads back what another bundle instance published", () => {
        // The CDN components bundle and the npm core bundle are separate
        // module instances; the window value is the shared authority, so it
        // must win over this instance's own default.
        window.__frakEnv = {
            wallet: "https://wallet-dev.frak.id",
            backend: "https://backend.gcp-dev.frak.id",
        };

        expect(getBackendUrl()).toBe("https://backend.gcp-dev.frak.id");
    });

    it("falls back to the module copy when there is no window", () => {
        // The SSR/node path, which the jsdom default never exercises.
        vi.stubGlobal("window", undefined);

        expect(setEnvironment("dev")).toEqual({
            wallet: "https://wallet-dev.frak.id",
            backend: "https://backend.gcp-dev.frak.id",
        });
        expect(getBackendUrl()).toBe("https://backend.gcp-dev.frak.id");

        vi.unstubAllGlobals();
    });
});
