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
 * The default user name
 */
const defaultUsername = "Frak Wallet";

export const WebAuthN = {
    rpId,
    rpName,
    rpOrigin,
    defaultUsername,
};
