import { isRunningInProd, isRunningLocally } from "../utils";
import { isTauri } from "../utils/platform";

/**
 * The RP ID for the webauthn
 * For Tauri mobile (iOS/Android), use wallet-dev.frak.id to match Associated Domains
 */
const rpName = "Frak wallet";
const rpId = isRunningInProd
    ? "frak.id"
    : isRunningLocally && !isTauri()
      ? "localhost"
      : "wallet-dev.frak.id";

const rpOrigin = isRunningInProd
    ? "https://wallet.frak.id"
    : isRunningLocally
      ? "https://localhost:3000"
      : "https://wallet-dev.frak.id";

/**
 * Mobile app origins for Tauri
 * - Android: APK signing key hash (changes per signing key)
 *   ⚠️ IMPORTANT: If the Android APK signing key changes, this hash MUST be updated
 *   to match the new signing key. The hash is used for WebAuthn Digital Asset Links
 *   verification. To get the hash: `keytool -list -v -keystore <keystore> -alias <alias>`
 *   then extract the SHA-256 fingerprint and base64url encode it.
 * - iOS: tauri://localhost
 */
const androidApkOrigin =
    "android:apk-key-hash:R68LewSdx_cfn9hNQdDKwm27UfBJXOjtIqC2u01wiHc";
const iosTauriOrigin = "tauri://localhost";

/**
 * All allowed origins for WebAuthn verification
 * Includes the web origin + mobile app origins
 */
const rpAllowedOrigins = [rpOrigin, androidApkOrigin, iosTauriOrigin];

/**
 * All allowed RP IDs for backend verification
 */
const rpAllowedIds = isRunningInProd
    ? ["frak.id"]
    : isRunningLocally
      ? ["localhost", "wallet-dev.frak.id"]
      : ["wallet-dev.frak.id"];

/**
 * The default user name
 */
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
