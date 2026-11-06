import { isRunningInProd } from "@frak-labs/app-essentials";

const hostApiKey = process.env.RAMP_HOST_API_KEY;

/** Unset until Ramp issues a key for the stage: the cash-out entry stays hidden. */
export const rampHostApiKey = hostApiKey ? hostApiKey : undefined;

export const isRampEnabled = rampHostApiKey !== undefined;

/** Testing and production keys only work against their own widget. */
export const RAMP_WIDGET_URL = isRunningInProd
    ? "https://app.rampnetwork.com"
    : "https://app.dev.ramp-network.org";

/** Ramp lists no EURe or EURC on Arbitrum: native USDC is the only usable route. */
export const RAMP_OFFRAMP_ASSET = "ARBITRUM_USDC";

/** Whole tokens. Ramp's EUR floor is ~6.7 € of crypto, before its fee. */
export const RAMP_MIN_AMOUNT = 10;

/** CoW has no Arbitrum Sepolia orderbook, so EURe can only be converted in prod. */
export const isEureSwapAvailable = isRunningInProd;
