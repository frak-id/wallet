/**
 * Per-locale text overrides for the post-purchase card. Fetched from the
 * `frak_i18n` metaobject (singleton entry with handle `default`) via the
 * Storefront API. Translations registered against the metaobject by
 * Shopify's Translate & Adapt app surface here automatically — the
 * Storefront API resolves the buyer's locale via the query's
 * `@inContext` directive.
 */

import { useEffect, useState } from "preact/hooks";

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

/**
 * Convert a BCP-47 ISO code (`fr`, `fr-CA`) to Shopify's `LanguageCode`
 * GraphQL enum (`FR`, `FR_CA`). `useLanguage().isoCode` returns BCP-47
 * with `-` separators; the GraphQL enum uses `_`.
 */
function toLanguageCode(isoCode: string): string {
    return isoCode.replace("-", "_").toUpperCase();
}

async function fetchPostPurchaseTextOverrides(
    query: StorefrontQuery,
    languageIsoCode: string
): Promise<PostPurchaseTextOverrides> {
    const response = await query<FetchFrakI18nData>(FETCH_QUERY, {
        variables: {
            type: FRAK_I18N_METAOBJECT_TYPE,
            handle: FRAK_I18N_SINGLETON_HANDLE,
            language: toLanguageCode(languageIsoCode),
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

/**
 * Fetch the post-purchase text overrides for the buyer's locale once on
 * mount (and whenever the language switches). Shared by the Thank You
 * and Order Status surfaces.
 */
export function usePostPurchaseTextOverrides(
    query: StorefrontQuery,
    languageIsoCode: string
): PostPurchaseTextOverrides | undefined {
    const [overrides, setOverrides] = useState<PostPurchaseTextOverrides>();
    useEffect(() => {
        let cancelled = false;
        fetchPostPurchaseTextOverrides(query, languageIsoCode)
            .then((next) => {
                if (!cancelled) setOverrides(next);
            })
            .catch(() => {});
        return () => {
            cancelled = true;
        };
    }, [query, languageIsoCode]);
    return overrides;
}
