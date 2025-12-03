import { isRunningInProd, isRunningLocally } from "../utils";

/**
 * The RP ID for the webauthn
 */
const rpName = "Frak wallet";
const rpId = isRunningLocally ? "localhost" : "frak.id";
const rpOrigin = isRunningInProd
    ? "https://wallet.frak.id"
    : isRunningLocally
      ? "https://localhost:3000"
      : "https://wallet-dev.frak.id";

/**
 * Mobile app origins for Tauri
 * - Android: APK signing key hash (changes per signing key)
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
 * The default user name
 */
const defaultUsername = "Frak Wallet";

export const WebAuthN = {
    rpId,
    rpName,
    rpOrigin,
    rpAllowedOrigins,
    defaultUsername,
};
