import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("webauthn utilities", () => {
    let originalWindow: typeof window;

    beforeEach(() => {
        originalWindow = global.window;
    });

    afterEach(() => {
        global.window = originalWindow;
        vi.resetModules();
    });

    it("should return true when WebAuthn is supported", async () => {
        Object.defineProperty(global.window, "PublicKeyCredential", {
            value: class PublicKeyCredential {},
            writable: true,
            configurable: true,
        });

        const { isWebAuthNSupported } = await import("./webauthn");
        expect(isWebAuthNSupported).toBe(true);
    });

    it("should return false when WebAuthn is not supported", async () => {
        Object.defineProperty(global.window, "PublicKeyCredential", {
            value: undefined,
            writable: true,
            configurable: true,
        });

        const { isWebAuthNSupported } = await import("./webauthn");
        expect(isWebAuthNSupported).toBe(false);
    });

    it("should return true with actual PublicKeyCredential implementation", async () => {
        // Simulate a browser with WebAuthn support
        const mockPublicKeyCredential = () => {};
        mockPublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable =
            async () => true;
        mockPublicKeyCredential.isConditionalMediationAvailable = async () =>
            true;

        Object.defineProperty(global.window, "PublicKeyCredential", {
            value: mockPublicKeyCredential,
            writable: true,
            configurable: true,
        });

        const { isWebAuthNSupported } = await import("./webauthn");
        expect(isWebAuthNSupported).toBe(true);
    });
});
