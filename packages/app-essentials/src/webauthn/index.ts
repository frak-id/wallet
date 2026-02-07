import { isRunningLocally } from "../utils";
import { isTauri } from "../utils/platform";

const rpName = "Frak wallet";
const rpId =
    isRunningLocally && !isTauri()
        ? "localhost"
        : (process.env.WEBAUTHN_RP_ID ?? "frak.id");

const rpOrigin =
    isRunningLocally && !isTauri()
        ? "https://localhost:3000"
        : (process.env.FRAK_WALLET_URL ?? "https://wallet.frak.id");

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

const rpAllowedIds = isRunningLocally ? ["localhost", rpId] : [rpId];

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
