import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function toAndroidApkOrigin(colonHex: string): string {
    const bytes = new Uint8Array(
        colonHex.split(":").map((byte) => Number.parseInt(byte, 16))
    );
    const base64 = btoa(String.fromCharCode(...bytes));
    const base64url = base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return `android:apk-key-hash:${base64url}`;
}

describe("WebAuthN config", () => {
    let originalWindow: typeof globalThis.window;

    beforeEach(() => {
        originalWindow = globalThis.window;
        vi.resetModules();

        Object.defineProperty(globalThis, "window", {
            value: {
                location: {
                    hostname: "localhost",
                    protocol: "tauri:",
                },
            },
            writable: true,
            configurable: true,
        });

        vi.stubEnv("STAGE", "local");
        vi.stubEnv("WEBAUTHN_RP_ID", "");
        vi.stubEnv("FRAK_WALLET_URL", "https://wallet-dev.frak.id");
    });

    afterEach(() => {
        globalThis.window = originalWindow;
        vi.unstubAllEnvs();
        vi.resetAllMocks();
    });

    it("should keep rpOrigin compatible with rpId in Tauri", async () => {
        const { WebAuthN } = await import("@frak-labs/app-essentials");
        const originHost = new URL(WebAuthN.rpOrigin).hostname;
        const isCompatible =
            originHost === WebAuthN.rpId ||
            originHost.endsWith(`.${WebAuthN.rpId}`);

        expect(isCompatible).toBe(true);
    });

    it("should support a single Android fingerprint", async () => {
        const fingerprint =
            "89:73:96:0B:97:5C:41:C4:4E:BD:1A:BA:4A:82:BD:BB:02:FC:5B:90:F0:C6:3F:58:BF:28:90:4F:9E:0A:CA:0E";
        vi.stubEnv("ANDROID_SHA256_FINGERPRINT", fingerprint);

        const { WebAuthN } = await import("@frak-labs/app-essentials");
        const expectedOrigin = toAndroidApkOrigin(fingerprint);

        expect(WebAuthN.androidApkOrigin).toBe(expectedOrigin);
        expect(WebAuthN.androidApkOrigins).toEqual([expectedOrigin]);
        expect(WebAuthN.rpAllowedOrigins).toContain(expectedOrigin);
    });

    it("should support comma-separated Android fingerprints", async () => {
        const firstFingerprint =
            "89:73:96:0B:97:5C:41:C4:4E:BD:1A:BA:4A:82:BD:BB:02:FC:5B:90:F0:C6:3F:58:BF:28:90:4F:9E:0A:CA:0E";
        const secondFingerprint =
            "E5:34:46:58:DF:83:AD:CF:0B:62:17:F9:46:9B:87:9D:F8:8F:14:D1:D6:8F:BC:6B:A4:7B:54:29:BE:51:4E:D4";

        vi.stubEnv(
            "ANDROID_SHA256_FINGERPRINT",
            `${firstFingerprint},${secondFingerprint}`
        );

        const { WebAuthN } = await import("@frak-labs/app-essentials");
        const firstOrigin = toAndroidApkOrigin(firstFingerprint);
        const secondOrigin = toAndroidApkOrigin(secondFingerprint);

        expect(WebAuthN.androidApkOrigin).toBe(firstOrigin);
        expect(WebAuthN.rpAllowedOrigins).toContain(firstOrigin);
        expect(WebAuthN.rpAllowedOrigins).toContain(secondOrigin);
    });

    it("should trim whitespace around comma-separated fingerprints", async () => {
        const fingerprint =
            "89:73:96:0B:97:5C:41:C4:4E:BD:1A:BA:4A:82:BD:BB:02:FC:5B:90:F0:C6:3F:58:BF:28:90:4F:9E:0A:CA:0E";
        vi.stubEnv("ANDROID_SHA256_FINGERPRINT", `  ${fingerprint}  `);

        const { WebAuthN } = await import("@frak-labs/app-essentials");

        expect(WebAuthN.androidApkOrigins).toEqual([
            toAndroidApkOrigin(fingerprint),
        ]);
    });

    it("should skip invalid fingerprints and warn", async () => {
        const validFingerprint =
            "89:73:96:0B:97:5C:41:C4:4E:BD:1A:BA:4A:82:BD:BB:02:FC:5B:90:F0:C6:3F:58:BF:28:90:4F:9E:0A:CA:0E";
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        vi.stubEnv(
            "ANDROID_SHA256_FINGERPRINT",
            `not-a-fingerprint,${validFingerprint}`
        );

        const { WebAuthN } = await import("@frak-labs/app-essentials");

        expect(WebAuthN.androidApkOrigins).toEqual([
            toAndroidApkOrigin(validFingerprint),
        ]);
        expect(warnSpy).toHaveBeenCalledOnce();
        warnSpy.mockRestore();
    });

    it("should deduplicate identical fingerprints in allowed origins", async () => {
        const fingerprint =
            "89:73:96:0B:97:5C:41:C4:4E:BD:1A:BA:4A:82:BD:BB:02:FC:5B:90:F0:C6:3F:58:BF:28:90:4F:9E:0A:CA:0E";
        vi.stubEnv(
            "ANDROID_SHA256_FINGERPRINT",
            `${fingerprint},${fingerprint}`
        );

        const { WebAuthN } = await import("@frak-labs/app-essentials");
        const origin = toAndroidApkOrigin(fingerprint);
        const count = WebAuthN.rpAllowedOrigins.filter(
            (o: string) => o === origin
        ).length;

        expect(count).toBe(1);
    });

    it("should return empty origins when env var is unset", async () => {
        vi.stubEnv("ANDROID_SHA256_FINGERPRINT", "");

        const { WebAuthN } = await import("@frak-labs/app-essentials");

        expect(WebAuthN.androidApkOrigins).toEqual([]);
        expect(WebAuthN.androidApkOrigin).toBe("");
    });
});
