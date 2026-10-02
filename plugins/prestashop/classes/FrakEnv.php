<?php

/**
 * Dev switch, driven by two optional constants a developer sets in
 * `config/defines_custom.inc.php`:
 *   - `FRAK_ENV`: only the string `dev` points the module at the Frak dev
 *     stack; any other defined value is production and reported as ignored.
 *   - `FRAK_MERCHANT_DOMAIN`: the merchant domain the shop acts as.
 *
 * With neither constant defined every method reports today's production
 * behaviour. Host normalisation lives in {@see FrakUtils}, not here.
 */
class FrakEnv
{
    /** Whether the dev stack is active (`FRAK_ENV` is exactly `dev`). */
    public static function isDev(): bool
    {
        return defined('FRAK_ENV') && constant('FRAK_ENV') === 'dev';
    }

    /** The `FRAK_ENV` value when it is defined but not `dev`, else null. */
    public static function ignoredValue(): ?string
    {
        if (!defined('FRAK_ENV') || self::isDev()) {
            return null;
        }
        $value = constant('FRAK_ENV');
        return is_string($value) ? $value : (string) json_encode($value);
    }

    /** The raw `FRAK_MERCHANT_DOMAIN` value, or an empty string when unset. */
    public static function merchantDomain(): string
    {
        if (!defined('FRAK_MERCHANT_DOMAIN') || !is_string(constant('FRAK_MERCHANT_DOMAIN'))) {
            return '';
        }
        return constant('FRAK_MERCHANT_DOMAIN');
    }
}
