import type { AuthenticatedContext } from "app/types/context";
import { LRUCache } from "lru-cache";
import { shopInfo } from "./shop";

const FRAK_NAMESPACE = "frak";
const MODAL_I18N_KEY = "modal_i18n";
const APPEARANCE_KEY = "appearance";
const MERCHANT_ID_KEY = "merchant_id";
const WALLET_URL_KEY = "wallet_url";
const COMPONENTS_URL_KEY = "components_url";
const SHARE_URL_KEY = "share_url";
const SHARE_BUTTON_HTML_KEY = "share_button_html";

/* -------------------------------------------------------------------------- */
/*                Translatable text metafield definitions                    */
/* -------------------------------------------------------------------------- */

/**
 * Per-locale merchant-customisable strings for the banner block, the
 * referral share button, and the post-purchase checkout extension.
 *
 * These are SHOP-owned metafields with text types (translatable by
 * Shopify's Translate & Adapt app). Each surface falls back through:
 *   block setting (when present) → this metafield → locale JSON (when
 *   surface supports it) → SDK default.
 *
 * Existing block settings still win, so theme upgrades remain backwards
 * compatible.
 */
export type FrakI18nMetafieldDefinition = {
    key: string;
    name: string;
    description: string;
    /** `single_line_text_field` for one-liners, `multi_line_text_field` for descriptions. */
    type: "single_line_text_field" | "multi_line_text_field";
};

export const FRAK_I18N_METAFIELD_DEFINITIONS: FrakI18nMetafieldDefinition[] = [
    {
        key: "banner_referral_title",
        name: "Banner — Referral title",
        description:
            "Referral banner heading shown to referred storefront visitors.",
        type: "single_line_text_field",
    },
    {
        key: "banner_referral_description",
        name: "Banner — Referral description",
        description: "Referral banner body shown under the heading.",
        type: "multi_line_text_field",
    },
    {
        key: "banner_referral_cta",
        name: "Banner — Referral button",
        description: "Referral banner call-to-action label.",
        type: "single_line_text_field",
    },
    {
        key: "banner_inapp_title",
        name: "Banner — In-app browser title",
        description:
            "Heading shown when the storefront opens in Instagram or Facebook's in-app browser.",
        type: "single_line_text_field",
    },
    {
        key: "banner_inapp_description",
        name: "Banner — In-app browser description",
        description:
            "Body shown when the storefront opens in an in-app browser.",
        type: "multi_line_text_field",
    },
    {
        key: "banner_inapp_cta",
        name: "Banner — In-app browser button",
        description: "Call-to-action label for the in-app browser banner.",
        type: "single_line_text_field",
    },
    {
        key: "button_share_text",
        name: "Share button — Label",
        description:
            "Storefront share button label. Use {REWARD} to embed the reward amount.",
        type: "single_line_text_field",
    },
    {
        key: "button_share_no_reward_text",
        name: "Share button — Fallback label",
        description:
            "Label shown when rewards are enabled on the share button but no reward is available.",
        type: "single_line_text_field",
    },
    {
        key: "post_purchase_message",
        name: "Post-purchase — Heading",
        description: "Heading on the post-purchase sharing card.",
        type: "single_line_text_field",
    },
    {
        key: "post_purchase_description",
        name: "Post-purchase — Description",
        description: "Body copy on the post-purchase sharing card.",
        type: "multi_line_text_field",
    },
    {
        key: "post_purchase_cta_text",
        name: "Post-purchase — Button",
        description: "Call-to-action label on the post-purchase sharing card.",
        type: "single_line_text_field",
    },
    {
        key: "post_purchase_badge_text",
        name: "Post-purchase — Badge",
        description:
            "Optional pill label above the heading. Leave empty to hide.",
        type: "single_line_text_field",
    },
];

/**
 * Metafield definition userError codes we can safely ignore.
 * `TAKEN` → the definition already exists (idempotent path).
 */
const IGNORABLE_DEFINITION_ERROR_CODES = new Set(["TAKEN"]);

export type AppearanceMetafieldValue = {
    logoUrl?: string;
};

export type I18nCustomizations = {
    fr?: SingleLanguageI18nCustomizations;
    en?: SingleLanguageI18nCustomizations;
};

export type MultiLanguageI18nCustomizations = {
    fr?: SingleLanguageI18nCustomizations;
    en?: SingleLanguageI18nCustomizations;
};

export type SingleLanguageI18nCustomizations = Record<string, string>;

/**
 * Read a metafield from the shop
 */
async function readMetafield<T>(
    graphql: AuthenticatedContext["admin"]["graphql"],
    key: string
): Promise<T | null> {
    const response = await graphql(
        `
      query GetShopMetafields($namespace: String!, $key: String!) {
        shop {
          metafield(namespace: $namespace, key: $key) {
            id
            value
            type
          }
        }
      }
    `,
        {
            variables: {
                namespace: FRAK_NAMESPACE,
                key,
            },
        }
    );

    const {
        data: { shop },
    } = await response.json();

    if (shop.metafield?.value) {
        try {
            return JSON.parse(shop.metafield.value) as T;
        } catch (error) {
            console.error("Error parsing metafield:", error);
        }
    }

    return null;
}

/**
 * Helper function to write to a metafield
 */
async function writeMetafield<T>(
    ctx: AuthenticatedContext,
    key: string,
    value: T | null
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    const {
        admin: { graphql },
    } = ctx;
    const shopId = await getShopId(ctx);

    // Get the right query depending on the value (either create / update or delete)
    const query = value
        ? graphql(
              `
          mutation CreateOrUpdateShopMetafield(
            $metafields: [MetafieldsSetInput!]!
          ) {
            metafieldsSet(metafields: $metafields) {
              metafields {
                id
                namespace
                key
                value
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
              {
                  variables: {
                      metafields: [
                          {
                              namespace: FRAK_NAMESPACE,
                              key,
                              type: "json",
                              value: value ? JSON.stringify(value) : undefined,
                              ownerId: shopId,
                          },
                      ],
                  },
              }
          )
        : graphql(
              `
          mutation DeleteShopMetafield(
            $metafields: [MetafieldIdentifierInput!]!
          ) {
            metafieldsDelete(metafields: $metafields) {
              deletedMetafields {
                key
                namespace
                ownerId
              }
              userErrors {
                field
                message
              }
            }
          }
        `,
              {
                  variables: {
                      metafields: [
                          {
                              namespace: FRAK_NAMESPACE,
                              key,
                              ownerId: shopId,
                          },
                      ],
                  },
              }
          );

    const response = await query;

    const {
        data: { metafieldsSet, metafieldsDelete },
    } = await response.json();

    return {
        success:
            metafieldsSet?.userErrors?.length === 0 ||
            metafieldsDelete?.userErrors?.length === 0,
        userErrors: metafieldsSet?.userErrors || metafieldsDelete?.userErrors,
    };
}

/* -------------------------------------------------------------------------- */
/*                                    i18n                                    */
/* -------------------------------------------------------------------------- */

/**
 * Parse a stored i18n metafield value into the normalized multi-language structure.
 */
export function parseI18nMetafield(
    value:
        | SingleLanguageI18nCustomizations
        | MultiLanguageI18nCustomizations
        | null
): I18nCustomizations {
    if (value) {
        const isFlatStructure =
            value && typeof value === "object" && !value.fr && !value.en;

        if (isFlatStructure) {
            return {
                en: value as Record<string, string>,
                fr: {},
            };
        }

        return value as I18nCustomizations;
    }

    return { fr: {}, en: {} };
}

/**
 * Get the i18n customizations from shop metafields
 */
export async function getI18nCustomizations({
    admin: { graphql },
}: AuthenticatedContext): Promise<I18nCustomizations> {
    const value = await readMetafield<
        SingleLanguageI18nCustomizations | MultiLanguageI18nCustomizations
    >(graphql, MODAL_I18N_KEY);

    return parseI18nMetafield(value);
}

/**
 * Drop empty-string entries so cleared fields fall back to SDK defaults
 * instead of persisting an override that the SDK would honour as a valid
 * (empty) translation.
 */
export function stripEmptyEntries(
    obj?: SingleLanguageI18nCustomizations
): SingleLanguageI18nCustomizations {
    if (!obj) return {};
    return Object.fromEntries(
        Object.entries(obj).filter(([, v]) => typeof v === "string" && v !== "")
    );
}

/**
 * Update the i18n customizations in shop metafields
 */
export async function updateI18nCustomizations(
    context: AuthenticatedContext,
    customizations: I18nCustomizations
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    const filtered: I18nCustomizations = {
        fr: stripEmptyEntries(customizations.fr),
        en: stripEmptyEntries(customizations.en),
    };

    const hasFrenchData = Object.keys(filtered.fr ?? {}).length > 0;
    const hasEnglishData = Object.keys(filtered.en ?? {}).length > 0;

    // All cleared → delete the metafield so the SDK falls back to defaults
    if (!hasFrenchData && !hasEnglishData) {
        return writeMetafield(context, MODAL_I18N_KEY, null);
    }

    const computedValueToStore = buildMetafieldValue(filtered, {
        hasFrenchData,
        hasEnglishData,
    });

    return writeMetafield(context, MODAL_I18N_KEY, computedValueToStore);
}

/**
 * Helper to compute the value we want to persist in the metafield, while keeping
 * the main updateI18nCustomizations function simple.
 */
export function buildMetafieldValue(
    customizations: I18nCustomizations,
    {
        hasFrenchData,
        hasEnglishData,
    }: {
        hasFrenchData: boolean;
        hasEnglishData: boolean;
    }
):
    | I18nCustomizations
    | SingleLanguageI18nCustomizations
    | Record<string, never> {
    const singleLanguageKey =
        hasEnglishData && !hasFrenchData
            ? "en"
            : hasFrenchData && !hasEnglishData
              ? "fr"
              : null;

    if (hasFrenchData && hasEnglishData) {
        return {
            fr: customizations.fr ?? {},
            en: customizations.en ?? {},
        };
    }

    if (singleLanguageKey) {
        const translations = customizations[singleLanguageKey] as Record<
            string,
            string
        >;
        return translations;
    }

    return {};
}

/* -------------------------------------------------------------------------- */
/*                                 Appearance                                 */
/* -------------------------------------------------------------------------- */

/**
 * Normalize appearance: return null if logoUrl is empty/missing.
 */
export function polishAppearance(
    appearance: AppearanceMetafieldValue
): AppearanceMetafieldValue | null {
    return appearance?.logoUrl?.length ? appearance : null;
}

export async function getAppearanceMetafield({
    admin: { graphql },
}: AuthenticatedContext): Promise<AppearanceMetafieldValue> {
    const value = await readMetafield<AppearanceMetafieldValue>(
        graphql,
        APPEARANCE_KEY
    );

    return value ?? {};
}

export async function updateAppearanceMetafield(
    context: AuthenticatedContext,
    appearance: AppearanceMetafieldValue
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    // Polish up the object (right now only the logo url, so if not present set it to null)
    const polishedAppearance = polishAppearance(appearance);
    return writeMetafield(context, APPEARANCE_KEY, polishedAppearance);
}

/* -------------------------------------------------------------------------- */
/*                                Merchant ID                                 */
/* -------------------------------------------------------------------------- */

/**
 * Read the cached merchantId from shop metafields.
 */
export async function getMerchantIdMetafield({
    admin: { graphql },
}: AuthenticatedContext): Promise<string | null> {
    return readMetafield<string>(graphql, MERCHANT_ID_KEY);
}

/**
 * Write merchantId to shop metafields so Liquid templates can read it.
 */
export async function writeMerchantIdMetafield(
    context: AuthenticatedContext,
    merchantId: string
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    return writeMetafield(context, MERCHANT_ID_KEY, merchantId);
}

/**
 * Get the shop ID for metafield operations
 */
export async function getShopId(ctx: AuthenticatedContext): Promise<string> {
    const info = await shopInfo(ctx);
    return info.id;
}

/* -------------------------------------------------------------------------- */
/*              Translatable text metafield definition setup                  */
/* -------------------------------------------------------------------------- */

const i18nDefinitionsSyncedShops = new LRUCache<string, boolean>({
    max: 512,
    ttl: 30 * 60_000,
});

/**
 * Register a single shop-owned metafield definition.
 *
 * Idempotent: re-running for an existing definition returns the `TAKEN`
 * userError code which we treat as success.
 */
async function createFrakI18nMetafieldDefinition(
    { admin: { graphql } }: AuthenticatedContext,
    definition: FrakI18nMetafieldDefinition
): Promise<{ ok: boolean; errors: Array<{ code?: string; message: string }> }> {
    const response = await graphql(
        `#graphql
        mutation CreateFrakI18nMetafieldDefinition(
            $definition: MetafieldDefinitionInput!
        ) {
            metafieldDefinitionCreate(definition: $definition) {
                createdDefinition { id }
                userErrors { field message code }
            }
        }`,
        {
            variables: {
                definition: {
                    name: definition.name,
                    namespace: FRAK_NAMESPACE,
                    key: definition.key,
                    description: definition.description,
                    type: definition.type,
                    ownerType: "SHOP",
                    access: {
                        admin: "MERCHANT_READ_WRITE",
                        storefront: "PUBLIC_READ",
                    },
                },
            },
        }
    );

    const {
        data: { metafieldDefinitionCreate },
    } = await response.json();

    const errors = (metafieldDefinitionCreate?.userErrors ?? []) as Array<{
        code?: string;
        message: string;
    }>;
    const blockingErrors = errors.filter(
        (e) => !e.code || !IGNORABLE_DEFINITION_ERROR_CODES.has(e.code)
    );

    return { ok: blockingErrors.length === 0, errors: blockingErrors };
}

/**
 * Ensure every translatable Frak text metafield definition exists on the
 * shop. Definitions enable Shopify's Translate & Adapt app to discover
 * the metafields and offer per-locale translation editors.
 *
 * Fire-and-forget; cached per shop for 30 minutes (same pattern as
 * `ensureWalletUrlMetafield` in merchant.ts).
 */
export async function ensureFrakI18nMetafieldDefinitions(
    context: AuthenticatedContext
): Promise<void> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;

    if (i18nDefinitionsSyncedShops.get(cacheKey)) return;

    const results = await Promise.allSettled(
        FRAK_I18N_METAFIELD_DEFINITIONS.map((def) =>
            createFrakI18nMetafieldDefinition(context, def)
        )
    );

    for (const [index, result] of results.entries()) {
        if (result.status === "rejected") {
            console.error(
                `[frakI18n] definition create failed for ${FRAK_I18N_METAFIELD_DEFINITIONS[index].key}:`,
                result.reason
            );
        } else if (!result.value.ok) {
            console.error(
                `[frakI18n] definition rejected for ${FRAK_I18N_METAFIELD_DEFINITIONS[index].key}:`,
                result.value.errors
            );
        }
    }

    i18nDefinitionsSyncedShops.set(cacheKey, true);
}

/* -------------------------------------------------------------------------- */
/*                                Wallet URL                                  */
/* -------------------------------------------------------------------------- */

/**
 * Read the wallet URL from shop metafields.
 */
export async function getWalletUrlMetafield({
    admin: { graphql },
}: AuthenticatedContext): Promise<string | null> {
    return readMetafield<string>(graphql, WALLET_URL_KEY);
}

/**
 * Write wallet URL to shop metafields so listener.liquid can read it.
 */
export async function writeWalletUrlMetafield(
    context: AuthenticatedContext,
    walletUrl: string
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    return writeMetafield(context, WALLET_URL_KEY, walletUrl);
}

/* -------------------------------------------------------------------------- */
/*                              Components URL                                */
/* -------------------------------------------------------------------------- */

/**
 * Read the components CDN URL from shop metafields.
 */
export async function getComponentsUrlMetafield({
    admin: { graphql },
}: AuthenticatedContext): Promise<string | null> {
    return readMetafield<string>(graphql, COMPONENTS_URL_KEY);
}

/**
 * Write components CDN URL to shop metafields so listener.liquid can read it.
 */
export async function writeComponentsUrlMetafield(
    context: AuthenticatedContext,
    componentsUrl: string
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    return writeMetafield(context, COMPONENTS_URL_KEY, componentsUrl);
}

/* -------------------------------------------------------------------------- */
/*                          Klaviyo share helpers                             */
/* -------------------------------------------------------------------------- */

/**
 * Read the Klaviyo share URL pattern from shop metafields.
 *
 * The value is a fully-qualified URL that, when visited, auto-opens the
 * Frak sharing page on the merchant's storefront via the `frakAction=share`
 * query param handled by the SDK loader.
 *
 * Merchants reference this metafield from their email-tool templates
 * (Klaviyo, Omnisend, Customer.io …) to drop a ready-to-use CTA without
 * hard-coding the storefront host.
 */
export async function getShareUrlMetafield({
    admin: { graphql },
}: AuthenticatedContext): Promise<string | null> {
    return readMetafield<string>(graphql, SHARE_URL_KEY);
}

/**
 * Write the Klaviyo share URL pattern. Wraps `writeMetafield` so the value
 * is JSON-encoded the same way every other Frak metafield is.
 */
export async function writeShareUrlMetafield(
    context: AuthenticatedContext,
    shareUrl: string
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    return writeMetafield(context, SHARE_URL_KEY, shareUrl);
}

/**
 * Read the Klaviyo paste-in share button HTML snippet from shop metafields.
 *
 * The value is a self-contained `<a>` tag with inline styles — valid in
 * every major email client, no external CSS, no JS. The snippet is built
 * server-side (see `ensureKlaviyoShareMetafields`) so it always reflects
 * the current storefront domain.
 */
export async function getShareButtonHtmlMetafield({
    admin: { graphql },
}: AuthenticatedContext): Promise<string | null> {
    return readMetafield<string>(graphql, SHARE_BUTTON_HTML_KEY);
}

/**
 * Write the Klaviyo paste-in share button HTML snippet.
 */
export async function writeShareButtonHtmlMetafield(
    context: AuthenticatedContext,
    html: string
): Promise<{
    success: boolean;
    userErrors: Array<{ field: string; message: string }>;
}> {
    return writeMetafield(context, SHARE_BUTTON_HTML_KEY, html);
}

/**
 * Build the canonical share URL for a given storefront host.
 *
 * The SDK loader treats `?frakAction=share` as a directive to auto-open
 * the sharing page on the next page load — see `handleActionQueryParam`
 * in `sdk/components/src/bootstrap/initFrakSdk.ts`.
 */
export function buildShareUrl(domain: string): string {
    return `https://${domain}/?frakAction=share`;
}

/**
 * Build the paste-in email share button HTML snippet.
 *
 * Inline styles only (email clients strip `<style>` blocks) and a fallback
 * font stack so the CTA renders consistently across Gmail / Outlook / Apple
 * Mail. Merchants can swap the `background-color` / `color` to match their
 * brand without breaking the layout.
 */
export function buildShareButtonHtml(domain: string): string {
    const shareUrl = buildShareUrl(domain);
    return `<a href="${shareUrl}" style="display:inline-block;padding:12px 28px;background-color:#121212;color:#ffffff;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;font-size:14px;font-weight:600;line-height:1.4;border-radius:6px;">Share &amp; earn</a>`;
}

/**
 * Read both Klaviyo share metafields in a single pass.
 *
 * Returned by the appearance loader so the admin UI can show what merchants
 * are about to paste into Klaviyo, alongside copy-to-clipboard buttons.
 */
export async function getKlaviyoShareMetafields(
    context: AuthenticatedContext
): Promise<{ shareUrl: string | null; shareButtonHtml: string | null }> {
    const [shareUrl, shareButtonHtml] = await Promise.all([
        getShareUrlMetafield(context),
        getShareButtonHtmlMetafield(context),
    ]);
    return { shareUrl, shareButtonHtml };
}
