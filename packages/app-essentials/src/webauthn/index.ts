import { isRunningInProd, isRunningLocally } from "../utils";
import { isTauri } from "../utils/platform";

/**
 * Tauri dev domain — must match Digital Asset Links (Android) and AASA (iOS)
 */
const tauriDevDomain = "wallet-dev.frak.id";

/**
 * Resolve the relying party ID based on environment:
 *  1. Explicit env override (set via Vite define or runtime)
 *  2. Tauri mobile app → dev domain with assetlinks/AASA
 *  3. Local web dev → localhost
 *  4. Production web → frak.id
 */
function resolveRpId(): string {
    if (process.env.WEBAUTHN_RP_ID) return process.env.WEBAUTHN_RP_ID;
    if (isTauri() && !isRunningInProd) return tauriDevDomain;
    if (isRunningLocally) return "localhost";
    return "frak.id";
}

function isRpOriginCompatibleWithId(origin: string, rpId: string): boolean {
    try {
        const hostname = new URL(origin).hostname;
        return hostname === rpId || hostname.endsWith(`.${rpId}`);
    } catch {
        return false;
    }
}

function resolveRpOrigin(rpId: string): string {
    const envOrigin = process.env.FRAK_WALLET_URL;

    // Native WebAuthn requires RP ID to match origin host (or parent domain).
    if (isTauri()) {
        if (envOrigin && isRpOriginCompatibleWithId(envOrigin, rpId)) {
            return envOrigin;
        }
        return `https://${rpId}`;
    }

    if (envOrigin) return envOrigin;
    if (isRunningLocally && !isTauri()) return "https://localhost:3000";
    if (!isRunningInProd) return "https://wallet-dev.frak.id";
    return "https://wallet.frak.id";
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

/**
 * iOS passkeys via ASAuthorization use the RP origin (e.g. https://frak.id)
 * as their origin — NOT tauri://localhost. This matches web credentials,
 * making passkeys portable between the iOS app and the web.
 */
const iosPasskeyOrigin = `https://${rpId}`;

const rpAllowedOrigins = Array.from(
    new Set([rpOrigin, ...androidApkOrigins, iosPasskeyOrigin].filter(Boolean))
);

/**
 * Allowed RP IDs for backend verification.
 * Non-production accepts web (localhost), Tauri dev domain, and resolved rpId.
 * Production only accepts the resolved rpId (frak.id).
 */
const rpAllowedIds = isRunningInProd
    ? [rpId]
    : Array.from(new Set(["localhost", tauriDevDomain, rpId]));

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
