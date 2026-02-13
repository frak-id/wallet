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
    if (isRunningLocally && isTauri()) return tauriDevDomain;
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
    return "https://wallet.frak.id";
}

/**
 * Derive the Android APK origin from the colon-hex SHA-256 fingerprint.
 *
 * Both `assetlinks.json` (colon-hex) and WebAuthn origin verification
 * (base64url) need the same signing key — deriving one from the other
 * ensures they can never diverge.
 *
 * @see https://developer.android.com/identity/sign-in/credential-manager#add-support-dal
 */
function resolveAndroidApkOrigin(): string {
    const hex = process.env.ANDROID_SHA256_FINGERPRINT;
    if (!hex) return "";

    const bytes = new Uint8Array(
        hex.split(":").map((b) => Number.parseInt(b, 16))
    );
    const base64 = btoa(String.fromCharCode(...bytes));
    const base64url = base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return `android:apk-key-hash:${base64url}`;
}

const rpName = "Frak wallet";
const rpId = resolveRpId();
const rpOrigin = resolveRpOrigin(rpId);

/**
 * Mobile app origins for Tauri
 * - Android: derived from ANDROID_SHA256_FINGERPRINT env var
 *   (same key used in /.well-known/assetlinks.json)
 * - iOS: tauri://localhost
 */
const androidApkOrigin = resolveAndroidApkOrigin();
const iosTauriOrigin = "tauri://localhost";

/** All allowed origins for WebAuthn verification (web + mobile) */
const rpAllowedOrigins = [rpOrigin, androidApkOrigin, iosTauriOrigin].filter(
    Boolean
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
    iosTauriOrigin,
};
