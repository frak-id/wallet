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
/*                Translatable text metaobject (Frak i18n)                    */
/* -------------------------------------------------------------------------- */

/**
 * Per-locale merchant-customisable strings for the banner block, the
 * referral share button, and the post-purchase checkout extension.
 *
 * Stored as a single merchant-owned metaobject of type `frak_i18n` with
 * one "default" entry. Surfaces as a dedicated section in Shopify's
 * Translate & Adapt app, away from the operational shop metafields
 * (modal_i18n, appearance, merchant_id, …).
 *
 * Why merchant-owned (no `$app:` prefix) despite app-owned being the
 * default for app-managed data: app-owned metaobjects are not reliably
 * accessible from Liquid theme app extensions (`shop.metaobjects['$app:…']`
 * returns empty in production stores; documented workarounds rely on the
 * fully-resolved `app--{app_id}--…` type name). Merchant-owned types
 * read cleanly via `shop.metaobjects.frak_i18n.default.<field>`.
 *
 * Resolution chain per surface:
 *   block setting → metaobject field → storefront `| t` → SDK default
 */

const FRAK_I18N_METAOBJECT_TYPE = "frak_i18n";
const FRAK_I18N_SINGLETON_HANDLE = "default";
const FRAK_I18N_DEFINITION_NAME = "Frak Translations";
const FRAK_I18N_DEFINITION_DESCRIPTION =
    "Per-locale text used by the Frak banner, share button, and post-purchase card. Edit non-default languages via Translate & Adapt.";
const FRAK_I18N_FR_LOCALE = "fr";

export type FrakI18nFieldDefinition = {
    key: string;
    name: string;
    description: string;
    type: "single_line_text_field" | "multi_line_text_field";
    /**
     * Seed values written on first install. `en` becomes the entry's
     * field value (source locale); `fr` is registered via
     * `translationsRegister`. Skipped when undefined.
     */
    defaults: { en?: string; fr?: string };
};

export const FRAK_I18N_FIELDS: FrakI18nFieldDefinition[] = [
    {
        key: "banner_referral_title",
        name: "Banner — Referral title",
        description:
            "Referral banner heading shown to referred storefront visitors.",
        type: "single_line_text_field",
        defaults: {
            en: "You've been referred!",
            fr: "Vous avez été parrainé !",
        },
    },
    {
        key: "banner_referral_description",
        name: "Banner — Referral description",
        description: "Referral banner body shown under the heading.",
        type: "multi_line_text_field",
        defaults: {
            en: "Make your first purchase to unlock your reward.",
            fr: "Effectuez votre premier achat pour débloquer votre récompense.",
        },
    },
    {
        key: "banner_referral_cta",
        name: "Banner — Referral button",
        description: "Referral banner call-to-action label.",
        type: "single_line_text_field",
        defaults: { en: "Got it", fr: "Compris" },
    },
    {
        key: "banner_inapp_title",
        name: "Banner — In-app browser title",
        description:
            "Heading shown when the storefront opens in Instagram or Facebook's in-app browser.",
        type: "single_line_text_field",
        defaults: {
            en: "Open in your browser",
            fr: "Ouvrir dans votre navigateur",
        },
    },
    {
        key: "banner_inapp_description",
        name: "Banner — In-app browser description",
        description:
            "Body shown when the storefront opens in an in-app browser.",
        type: "multi_line_text_field",
        defaults: {
            en: "For the best experience, open this page in your system browser.",
            fr: "Pour une meilleure expérience, ouvrez cette page dans le navigateur de votre téléphone.",
        },
    },
    {
        key: "banner_inapp_cta",
        name: "Banner — In-app browser button",
        description: "Call-to-action label for the in-app browser banner.",
        type: "single_line_text_field",
        defaults: { en: "Open browser", fr: "Ouvrir le navigateur" },
    },
    {
        key: "button_share_text",
        name: "Share button — Label",
        description:
            "Storefront share button label. Use {REWARD} to embed the reward amount.",
        type: "single_line_text_field",
        defaults: { en: "Share and earn!", fr: "Partage et gagne !" },
    },
    {
        key: "button_share_no_reward_text",
        name: "Share button — Fallback label",
        description:
            "Label shown when rewards are enabled on the share button but no reward is available.",
        type: "single_line_text_field",
        defaults: { en: "Share and earn!", fr: "Partage et gagne !" },
    },
    {
        key: "post_purchase_message",
        name: "Post-purchase — Heading",
        description: "Heading on the post-purchase sharing card.",
        type: "single_line_text_field",
        defaults: {
            en: "Earn rewards through sharing",
            fr: "Gagnez des récompenses en partageant",
        },
    },
    {
        key: "post_purchase_description",
        name: "Post-purchase — Description",
        description: "Body copy on the post-purchase sharing card.",
        type: "multi_line_text_field",
        defaults: {
            en: "If they buy, they earn... and so do you!",
            fr: "S'ils achètent, ils gagnent… et vous aussi !",
        },
    },
    {
        key: "post_purchase_cta_text",
        name: "Post-purchase — Button",
        description: "Call-to-action label on the post-purchase sharing card.",
        type: "single_line_text_field",
        defaults: { en: "Share & earn", fr: "Partager & gagner" },
    },
    {
        key: "post_purchase_badge_text",
        name: "Post-purchase — Badge",
        description:
            "Optional pill label above the heading. Leave empty to hide.",
        type: "single_line_text_field",
        defaults: {},
    },
];

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
/*              Frak i18n metaobject — singleton entry orchestrator           */
/* -------------------------------------------------------------------------- */

const i18nMetaobjectSyncedShops = new LRUCache<string, boolean>({
    max: 512,
    ttl: 30 * 60_000,
});

const IGNORABLE_METAOBJECT_DEFINITION_ERROR_CODES = new Set(["TAKEN"]);

type GraphQLBody<TData> = {
    data?: TData;
    errors?: Array<{ message: string }>;
};

/**
 * Boilerplate-free GraphQL call. Logs and returns `null` on transport
 * errors, JSON parse failures, or top-level GraphQL errors; callers
 * handle `userErrors` from the returned data.
 */
async function runGraphQL<TData>(
    graphql: AuthenticatedContext["admin"]["graphql"],
    label: string,
    query: string,
    variables: Record<string, unknown>
): Promise<TData | null> {
    try {
        const response = await graphql(query, { variables });
        const body = (await response.json()) as GraphQLBody<TData>;
        if (body.errors?.length) {
            console.error(`[frakI18n] ${label} top-level errors:`, body.errors);
            return null;
        }
        return body.data ?? null;
    } catch (error) {
        console.error(`[frakI18n] ${label} threw:`, error);
        return null;
    }
}

/**
 * Single round-trip read of the singleton state. The orchestrator uses
 * this to decide whether to create the definition and/or seed the entry.
 */
async function readFrakI18nState(
    context: AuthenticatedContext
): Promise<{ definitionExists: boolean; entryId: string | null } | null> {
    const data = await runGraphQL<{
        metaobjectDefinitionByType?: { id?: string } | null;
        metaobject?: { id?: string } | null;
    }>(
        context.admin.graphql,
        "state read",
        `#graphql
        query ReadFrakI18nState(
            $type: String!
            $entryHandle: MetaobjectHandleInput!
        ) {
            metaobjectDefinitionByType(type: $type) { id }
            metaobject(handle: $entryHandle) { id }
        }`,
        {
            type: FRAK_I18N_METAOBJECT_TYPE,
            entryHandle: {
                type: FRAK_I18N_METAOBJECT_TYPE,
                handle: FRAK_I18N_SINGLETON_HANDLE,
            },
        }
    );
    if (!data) return null;
    return {
        definitionExists: Boolean(data.metaobjectDefinitionByType?.id),
        entryId: data.metaobject?.id ?? null,
    };
}

async function createFrakI18nDefinition(
    context: AuthenticatedContext
): Promise<boolean> {
    const data = await runGraphQL<{
        metaobjectDefinitionCreate?: {
            userErrors?: Array<{ code?: string; message: string }>;
        };
    }>(
        context.admin.graphql,
        "definition create",
        `#graphql
        mutation CreateFrakI18nDefinition(
            $definition: MetaobjectDefinitionCreateInput!
        ) {
            metaobjectDefinitionCreate(definition: $definition) {
                metaobjectDefinition { id }
                userErrors { field message code }
            }
        }`,
        {
            definition: {
                type: FRAK_I18N_METAOBJECT_TYPE,
                name: FRAK_I18N_DEFINITION_NAME,
                description: FRAK_I18N_DEFINITION_DESCRIPTION,
                access: { storefront: "PUBLIC_READ" },
                capabilities: {
                    publishable: { enabled: true },
                    translatable: { enabled: true },
                },
                fieldDefinitions: FRAK_I18N_FIELDS.map((f) => ({
                    key: f.key,
                    name: f.name,
                    description: f.description,
                    type: f.type,
                })),
            },
        }
    );
    if (!data) return false;
    const errors = data.metaobjectDefinitionCreate?.userErrors ?? [];
    const blocking = errors.filter(
        (e) =>
            !e.code || !IGNORABLE_METAOBJECT_DEFINITION_ERROR_CODES.has(e.code)
    );
    if (blocking.length > 0) {
        console.error(
            "[frakI18n] definition create rejected:",
            JSON.stringify(blocking)
        );
        return false;
    }
    return true;
}

/**
 * Create the singleton entry with bundled EN seeds. Only invoked when
 * the state read confirmed no entry exists yet, so merchant edits on
 * existing EN values are never overwritten. `publishable.status = ACTIVE`
 * requires the definition's `publishable: { enabled: true }` capability.
 */
async function upsertFrakI18nEntry(
    context: AuthenticatedContext
): Promise<string | null> {
    const fields = FRAK_I18N_FIELDS.flatMap((f) =>
        f.defaults.en ? [{ key: f.key, value: f.defaults.en }] : []
    );
    const data = await runGraphQL<{
        metaobjectUpsert?: {
            metaobject?: { id?: string } | null;
            userErrors?: Array<{
                field?: string[];
                message: string;
                code?: string;
            }>;
        };
    }>(
        context.admin.graphql,
        "entry upsert",
        `#graphql
        mutation UpsertFrakI18nEntry(
            $handle: MetaobjectHandleInput!
            $metaobject: MetaobjectUpsertInput!
        ) {
            metaobjectUpsert(handle: $handle, metaobject: $metaobject) {
                metaobject { id }
                userErrors { field message code }
            }
        }`,
        {
            handle: {
                type: FRAK_I18N_METAOBJECT_TYPE,
                handle: FRAK_I18N_SINGLETON_HANDLE,
            },
            metaobject: {
                fields,
                capabilities: { publishable: { status: "ACTIVE" } },
            },
        }
    );
    if (!data) return null;
    const result = data.metaobjectUpsert;
    if (result?.userErrors?.length) {
        console.error(
            "[frakI18n] entry upsert userErrors:",
            JSON.stringify(result.userErrors)
        );
    }
    return result?.metaobject?.id ?? null;
}

type FrakI18nFieldTranslationState = {
    digestByKey: Map<string, string>;
    keysWithFr: Set<string>;
};

/**
 * Fetch translatable digests + existing FR translations for the singleton
 * entry. Unlike metafields (one translatable "value" key), metaobjects
 * expose one translatable entry PER field — so the digest map is keyed
 * by our field keys directly.
 */
async function readFrakI18nFieldTranslationState(
    context: AuthenticatedContext,
    entryId: string
): Promise<FrakI18nFieldTranslationState | null> {
    const data = await runGraphQL<{
        translatableResourcesByIds?: {
            nodes?: Array<{
                translatableContent?: Array<{ key: string; digest?: string }>;
                translations?: Array<{ key: string; value?: string }>;
            }>;
        };
    }>(
        context.admin.graphql,
        "translation state read",
        `#graphql
        query ReadFrakI18nFieldTranslationState(
            $resourceIds: [ID!]!
            $locale: String!
        ) {
            translatableResourcesByIds(first: 1, resourceIds: $resourceIds) {
                nodes {
                    translatableContent { key digest }
                    translations(locale: $locale) { key value }
                }
            }
        }`,
        { resourceIds: [entryId], locale: FRAK_I18N_FR_LOCALE }
    );
    if (!data) return null;
    const node = data.translatableResourcesByIds?.nodes?.[0];
    const digestByKey = new Map<string, string>();
    const keysWithFr = new Set<string>();
    for (const c of node?.translatableContent ?? []) {
        if (typeof c.digest === "string") digestByKey.set(c.key, c.digest);
    }
    for (const t of node?.translations ?? []) {
        if (typeof t.value === "string" && t.value.length > 0)
            keysWithFr.add(t.key);
    }
    return { digestByKey, keysWithFr };
}

async function registerFrakI18nFrTranslations(
    context: AuthenticatedContext,
    entryId: string,
    translations: Array<{ key: string; value: string; digest: string }>
): Promise<boolean> {
    if (translations.length === 0) return true;
    const data = await runGraphQL<{
        translationsRegister?: {
            userErrors?: Array<{ message: string }>;
        };
    }>(
        context.admin.graphql,
        "fr register",
        `#graphql
        mutation RegisterFrakI18nFrTranslations(
            $resourceId: ID!
            $translations: [TranslationInput!]!
        ) {
            translationsRegister(
                resourceId: $resourceId
                translations: $translations
            ) {
                userErrors { field message code }
            }
        }`,
        {
            resourceId: entryId,
            translations: translations.map((t) => ({
                locale: FRAK_I18N_FR_LOCALE,
                key: t.key,
                value: t.value,
                translatableContentDigest: t.digest,
            })),
        }
    );
    if (!data) return false;
    const errors = data.translationsRegister?.userErrors ?? [];
    if (errors.length > 0) {
        console.error("[frakI18n] fr translations rejected:", errors);
        return false;
    }
    return true;
}

/**
 * Idempotent: ensure the `frak_i18n` metaobject definition exists, create
 * the singleton entry with bundled EN seeds when missing, then register
 * the bundled FR translations for any field that doesn't already have one.
 * Merchant EN edits are preserved (the entry is only seeded on first
 * create); FR overrides are preserved via the `keysWithFr` check.
 *
 * Cached per shop for 30 minutes — but only on full success, so partial
 * failures stay retryable on the next loader call.
 */
export async function ensureFrakI18nMetaobject(
    context: AuthenticatedContext
): Promise<void> {
    const shop = await shopInfo(context);
    const cacheKey = shop.normalizedDomain;
    if (i18nMetaobjectSyncedShops.get(cacheKey)) return;

    const state = await readFrakI18nState(context);
    if (!state) return;
    if (!state.definitionExists) {
        const created = await createFrakI18nDefinition(context);
        if (!created) return;
    }
    const entryId = state.entryId ?? (await upsertFrakI18nEntry(context));
    if (!entryId) return;

    const frOk = await syncFrakI18nFrTranslations(context, entryId);
    if (frOk) i18nMetaobjectSyncedShops.set(cacheKey, true);
}

async function syncFrakI18nFrTranslations(
    context: AuthenticatedContext,
    entryId: string
): Promise<boolean> {
    const state = await readFrakI18nFieldTranslationState(context, entryId);
    if (!state) return false;
    const missing = FRAK_I18N_FIELDS.flatMap((f) => {
        if (!f.defaults.fr) return [];
        if (state.keysWithFr.has(f.key)) return [];
        const digest = state.digestByKey.get(f.key);
        if (!digest) return [];
        return [{ key: f.key, value: f.defaults.fr, digest }];
    });
    return registerFrakI18nFrTranslations(context, entryId, missing);
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
