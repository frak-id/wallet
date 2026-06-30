import { sdkConfigStore } from "@frak-labs/core-sdk";
import { renderHook } from "@testing-library/preact";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useLang } from "./useLang";

function setBrowserLanguage(value: string | undefined) {
    Object.defineProperty(navigator, "language", {
        value,
        configurable: true,
    });
}

describe.sequential("useLang", () => {
    afterEach(() => {
        sdkConfigStore.clearCache();
        sdkConfigStore.reset();
        setBrowserLanguage("en-US");
        vi.restoreAllMocks();
    });

    it("prefers the resolved config language over the browser", () => {
        setBrowserLanguage("en-US");
        sdkConfigStore.setConfig({
            isResolved: true,
            merchantId: "merchant",
            lang: "fr",
        });

        const { result } = renderHook(() => useLang());
        expect(result.current).toBe("fr");
    });

    it("falls back to the browser language when config has no lang", () => {
        setBrowserLanguage("fr-FR");
        sdkConfigStore.setConfig({
            isResolved: true,
            merchantId: "merchant",
        });

        const { result } = renderHook(() => useLang());
        expect(result.current).toBe("fr");
    });

    it("defaults to English for unsupported browser languages", () => {
        setBrowserLanguage("de-DE");
        sdkConfigStore.reset();

        const { result } = renderHook(() => useLang());
        expect(result.current).toBe("en");
    });
});
