import { describe, expect, it } from "vitest";
import { safeRedirectTarget } from "./safeRedirect";

describe("safeRedirectTarget", () => {
    it("defaults to /dashboard when absent", () => {
        expect(safeRedirectTarget(undefined)).toBe("/dashboard");
        expect(safeRedirectTarget(null)).toBe("/dashboard");
        expect(safeRedirectTarget("")).toBe("/dashboard");
    });

    it("allows same-origin relative paths", () => {
        expect(safeRedirectTarget("/m/abc/dashboard")).toBe("/m/abc/dashboard");
        expect(safeRedirectTarget("/settings/security?tab=2fa")).toBe(
            "/settings/security?tab=2fa"
        );
    });

    it("rejects absolute external URLs (open-redirect guard)", () => {
        expect(safeRedirectTarget("https://evil.com")).toBe("/dashboard");
        expect(safeRedirectTarget("http://evil.com/x")).toBe("/dashboard");
        expect(safeRedirectTarget("javascript:alert(1)")).toBe("/dashboard");
    });

    it("rejects protocol-relative and backslash tricks", () => {
        expect(safeRedirectTarget("//evil.com")).toBe("/dashboard");
        expect(safeRedirectTarget("/\\evil.com")).toBe("/dashboard");
        expect(safeRedirectTarget("/path\\..\\x")).toBe("/dashboard");
    });
});
