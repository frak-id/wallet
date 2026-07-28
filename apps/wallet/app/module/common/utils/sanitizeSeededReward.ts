/**
 * Longest plausible formatted reward headline (`"1 234,56 €"` and the like),
 * with room for longer currency names. Anything beyond this is not a reward.
 */
const MAX_LENGTH = 32;



/**
 * The shape this field can take.
 *
 * The seeded value mirrors what the reward selector produces (`"5 €"`,
 * `"10 %"`): the supported currencies are eur, usd and gbp, all formatted with
 * a currency symbol, so a genuine value carries a digit and a symbol or percent
 * and no letters at all. Any qualifier ("up to") is added by the page from its
 * own translations, never carried in the value.
 *
 * Requiring that shape is what keeps the field from delivering free copy into
 * the merchant's sheet: length and character class alone still accepted short
 * prose like "1 free iPhone".
 */
/**
 * An amount with a trailing unit (`"1 234,56 €"`, `"10 %"`) or a leading one
 * (`"$1,234.56"`). Separators cover the spaces and marks locales place inside
 * a number, including the narrow no-break space `Intl` emits.
 */
const SHAPE =
    /^(?:\p{N}[\p{N} \u00a0\u202f.,]*[\p{Sc}%]|[\p{Sc}%][ \u00a0\u202f]?\p{N}[\p{N}.,\u00a0\u202f ]*)$/u;

/**
 * Sanitize a host-seeded reward headline.
 *
 * The value is painted on the first frame before the real reward query
 * resolves, so it is attacker-controllable display text. It is bounded and
 * restricted to what a formatted amount can contain; anything else is dropped
 * in favour of the normal loading state.
 */
export function sanitizeSeededReward(value: unknown): string | undefined {
    if (typeof value !== "string") return undefined;
    const trimmed = value.trim();
    if (!trimmed || trimmed.length > MAX_LENGTH) return undefined;
    return SHAPE.test(trimmed) ? trimmed : undefined;
}
