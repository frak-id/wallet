import type { AuthenticatedContext } from "app/types/context";
import { shopInfo } from "./shop";

const FRAK_NAMESPACE = "frak";
const MODAL_I18N_KEY = "modal_i18n";
const APPEARANCE_KEY = "appearance";
const MERCHANT_ID_KEY = "merchant_id";
const WALLET_URL_KEY = "wallet_url";
const COMPONENTS_URL_KEY = "components_url";

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
