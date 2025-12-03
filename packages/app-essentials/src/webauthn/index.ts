import { isRunningInProd, isRunningLocally } from "../utils";
import { isTauri } from "../utils/platform";

/**
 * The RP ID for the webauthn
 */
const rpName = "Frak wallet";

// For Tauri mobile (iOS/Android), use dev domain for testing
// iOS requires Associated Domains to be configured for passkeys to work
// TODO: Change to wallet.frak.id for production release
const rpId = isTauri()
    ? "wallet-dev.frak.id"
    : isRunningLocally
      ? "localhost"
      : "frak.id";

// Primary origin for client-side WebAuthn
const rpOrigin = isTauri()
    ? "https://wallet-dev.frak.id"
    : isRunningInProd
      ? "https://wallet.frak.id"
      : isRunningLocally
        ? "https://localhost:3000"
        : "https://wallet-dev.frak.id";

// All allowed origins for backend verification (includes Tauri mobile origins)
// Tauri Android uses APK key hash as origin for WebAuthn
// Tauri iOS uses tauri://localhost as origin
// Debug APK hash: J5BkkRNeQIjYwltCaq5W4EKI5Bj4X9pA8rxuepD24SQ
const androidApkOrigin =
    "android:apk-key-hash:J5BkkRNeQIjYwltCaq5W4EKI5Bj4X9pA8rxuepD24SQ";
const iosTauriOrigin = "tauri://localhost";

const rpAllowedOrigins = isRunningInProd
    ? ["https://wallet.frak.id", androidApkOrigin, iosTauriOrigin]
    : isRunningLocally
      ? ["https://localhost:3000", androidApkOrigin, iosTauriOrigin]
      : ["https://wallet-dev.frak.id", androidApkOrigin, iosTauriOrigin];

// All allowed RP IDs for backend verification
// Include wallet-dev.frak.id for Tauri mobile apps in all environments
const rpAllowedIds = isRunningInProd
    ? ["frak.id", "wallet-dev.frak.id"]
    : isRunningLocally
      ? ["localhost", "wallet-dev.frak.id"]
      : ["frak.id", "wallet-dev.frak.id"];

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
};
