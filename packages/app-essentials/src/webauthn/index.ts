import { isRunningLocally } from "../utils";

/**
 * The RP ID for the webauthn
 */
const rpName = "Frak wallet";
const rpId = isRunningLocally ? "localhost" : "frak.id";
const rpOrigin = appUrl;

/**
 * The default user name
 */
const defaultUsername = "Frak Wallet";

export const WebauthN = {
    rpId,
    rpName,
    rpOrigin,
    defaultUsername
}