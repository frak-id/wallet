/**
 * Per-locale text overrides for the post-purchase card. Fetched from the
 * `frak_i18n` metaobject (singleton entry with handle `default`) via the
 * Storefront API. Translations registered against the metaobject by
 * Shopify's Translate & Adapt app surface here automatically — the
 * Storefront API resolves the buyer's locale via the query's
 * `@inContext` directive.
 */

export type PostPurchaseTextOverrides = {
    message?: string;
    description?: string;
    ctaText?: string;
    badgeText?: string;
};

const FRAK_I18N_METAOBJECT_TYPE = "frak_i18n";
const FRAK_I18N_SINGLETON_HANDLE = "default";

const FETCH_QUERY = `#graphql
  query FetchFrakI18n(
    $type: String!
    $handle: String!
    $language: LanguageCode!
  ) @inContext(language: $language) {
    metaobject(handle: { type: $type, handle: $handle }) {
      fields { key value }
    }
  }
`;

type FetchFrakI18nData = {
    metaobject?: {
        fields?: Array<{ key: string; value: string | null }>;
    } | null;
};

type StorefrontQuery = <Data>(
    query: string,
    options?: { variables?: Record<string, unknown> }
) => Promise<{ data?: Data; errors?: Array<{ message: string }> }>;

function nonEmpty(value: string | null | undefined): string | undefined {
    return value && value.length > 0 ? value : undefined;
}

export async function fetchPostPurchaseTextOverrides(
    query: StorefrontQuery,
    languageIsoCode: string
): Promise<PostPurchaseTextOverrides> {
    const response = await query<FetchFrakI18nData>(FETCH_QUERY, {
        variables: {
            type: FRAK_I18N_METAOBJECT_TYPE,
            handle: FRAK_I18N_SINGLETON_HANDLE,
            language: languageIsoCode.toUpperCase(),
        },
    });
    const fields = response?.data?.metaobject?.fields;
    if (!fields) return {};
    const map = new Map<string, string | null>();
    for (const f of fields) map.set(f.key, f.value);
    return {
        message: nonEmpty(map.get("post_purchase_message")),
        description: nonEmpty(map.get("post_purchase_description")),
        ctaText: nonEmpty(map.get("post_purchase_cta_text")),
        badgeText: nonEmpty(map.get("post_purchase_badge_text")),
    };
}
