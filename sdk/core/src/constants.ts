/**
 * The backup key for client side backup if needed
 */
export const BACKUP_KEY = "nexus-wallet-backup";

/**
 * Deep link scheme for Frak Wallet mobile app.
 *
 * Replaced at build time via tsdown/Vite `define`. Defaults to the prod scheme;
 * in-monorepo dev builds (listener at wallet-dev.frak.id) override this with
 * `frakwallet-dev://` so deep links open the dev wallet variant (id.frak.wallet.dev).
 * External integrators consuming the published NPM/CDN bundle always see the prod scheme.
 */
export const DEEP_LINK_SCHEME: string =
    process.env.DEEP_LINK_SCHEME ?? "frakwallet://";
