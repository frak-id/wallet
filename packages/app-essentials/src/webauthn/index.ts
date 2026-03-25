import { isRunningInProd, isRunningLocally } from "../utils";
import { isTauri } from "../utils/platform";

function resolveRpId(): string {
    if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
    if (isTauri()) return "frak.id";
    if (isRunningLocally) return "localhost";
    return "frak.id";
}

function resolveRpOrigin(rpId: string): string {
    const envOrigin = process.env.FRAK_WALLET_URL;

    if (isTauri()) {
        if (envOrigin && isRpOriginCompatibleWithId(envOrigin, rpId)) {
            return envOrigin;
        }
        return `https://${rpId}`;
    }

    if (envOrigin) return envOrigin;
    if (isRunningLocally) return "https://localhost:3000";
    if (!isRunningInProd) return "https://wallet-dev.frak.id";
    return "https://wallet.frak.id";
}

function isRpOriginCompatibleWithId(origin: string, rpId: string): boolean {
    try {
        const hostname = new URL(origin).hostname;
        return hostname === rpId || hostname.endsWith(`.${rpId}`);
    } catch {
        return false;
    }
}

const sha256FingerprintPattern = /^([0-9A-Fa-f]{2}:){31}[0-9A-Fa-f]{2}$/;

function toAndroidApkOrigin(colonHexFingerprint: string): string {
    const bytes = new Uint8Array(
        colonHexFingerprint.split(":").map((byte) => Number.parseInt(byte, 16))
    );
    const base64 = btoa(String.fromCharCode(...bytes));
    const base64url = base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return `android:apk-key-hash:${base64url}`;
}

/**
 * Derive Android APK origin(s) from SHA-256 fingerprint(s).
 *
 * Supports a single fingerprint or a comma-separated list to cover
 * multiple signing keys (e.g. upload key + Play App Signing key).
 *
 * @see https://developer.android.com/identity/sign-in/credential-manager#add-support-dal
 */
function resolveAndroidApkOrigins(): string[] {
    const rawFingerprints = process.env.ANDROID_SHA256_FINGERPRINT;
    if (!rawFingerprints) return [];

    const trimmed = rawFingerprints
        .split(",")
        .map((fingerprint) => fingerprint.trim())
        .filter(Boolean);

    const valid: string[] = [];
    for (const fingerprint of trimmed) {
        if (sha256FingerprintPattern.test(fingerprint)) {
            valid.push(toAndroidApkOrigin(fingerprint));
        } else {
            console.warn(
                `[WebAuthN] Ignoring malformed SHA-256 fingerprint: "${fingerprint}"`
            );
        }
    }
    return valid;
}

const rpName = "Frak wallet";
const rpId = resolveRpId();
const rpOrigin = resolveRpOrigin(rpId);

const androidApkOrigins = resolveAndroidApkOrigins();
const androidApkOrigin = androidApkOrigins[0] ?? "";

const iosPasskeyOrigin = `https://${rpId}`;

const rpAllowedOrigins = Array.from(
    new Set(
        [rpOrigin, ...androidApkOrigins, iosPasskeyOrigin].filter(Boolean)
    )
);

const rpAllowedIds = isRunningInProd
    ? [rpId]
    : Array.from(new Set(["localhost", "frak.id", rpId]));

const defaultUsername = "Frak Wallet";

export const WebAuthN = {
    rpId,
    rpName,
    rpOrigin,
    rpAllowedOrigins,
    rpAllowedIds,
    defaultUsername,
    androidApkOrigin,
    androidApkOrigins,
    iosPasskeyOrigin,
};
