import { t } from "@backend-utils";
import type { Static } from "elysia";

/**
 * Wire format for the caller's preferred display currency. Lowercase to
 * mirror the SDK's `Currency` union (`@frak-labs/core-sdk`:
 * `"eur" | "usd" | "gbp"`). The backend normalises this to uppercase
 * ISO-4217 via `toFiatCurrency` before hitting the pricing layer.
 *
 * Optional at every edge — omitting it means "use the default" (EUR),
 * which `toFiatCurrency` also enforces for unknown values.
 */
export const CurrencyParamSchema = t.Union([
    t.Literal("eur"),
    t.Literal("usd"),
    t.Literal("gbp"),
]);
export type CurrencyParam = Static<typeof CurrencyParamSchema>;
