import { parse as jsonc_parse } from "jsonc-parser";
import { LRUCache } from "lru-cache";
import type { AuthenticatedContext } from "../types/context";

type ThemeFile = {
    filename: string;
    body: {
        content: string;
        sections: {
            id: string;
            section: { type: string; block_order: string[] };
        };
    };
};

/**
 * GraphQL query to fetch theme files from Shopify
 */
const getFilesQuery = `
query getFiles($filenames: [String!]!, $themeId: ID!) {
  theme(id: $themeId) {
    files(filenames: $filenames) {
      nodes {
        filename
        body {
        ... on OnlineStoreThemeFileBodyText { content }
        ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
        }
      }
    }
  }
}
`;

/**
 * Paginated variant of `getFilesQuery` that supports wildcard patterns and
 * cursor-based pagination. Used to enumerate every file matching a set of
 * patterns (e.g. `sections/*.json`) because Shopify may truncate responses
 * below the requested page size to stay within payload limits.
 */
const getFilesPaginatedQuery = `
query getFilesPaginated($filenames: [String!]!, $themeId: ID!, $cursor: String) {
  theme(id: $themeId) {
    files(first: 50, after: $cursor, filenames: $filenames) {
      nodes {
        filename
        body {
          ... on OnlineStoreThemeFileBodyText { content }
          ... on OnlineStoreThemeFileBodyBase64 { contentBase64 }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

export type GetMainThemeIdReturnType = {
    gid: string;
    id: string;
};

const mainThemeIdCache = new LRUCache<string, GetMainThemeIdReturnType>({
    max: 512,
    // TTL of 30 seconds
    ttl: 30_000,
});

/**
 * GraphQL query to fetch main theme id
 */
export async function getMainThemeId(
    context: AuthenticatedContext
): Promise<GetMainThemeIdReturnType> {
    const cachedMainThemeId = mainThemeIdCache.get(context.session.shop);
    if (cachedMainThemeId) {
        return cachedMainThemeId;
    }

    const response = await context.admin.graphql(`
query getMainThemeId {
  themes(first: 1, roles: [MAIN]) {
    nodes {
      id
    }
  }
}`);
    const {
        data: { themes },
    } = await response.json();
    const gid = themes?.nodes?.[0]?.id;

    // Extract the theme id from the full string (e.g. "gid://shopify/OnlineStoreTheme/140895584433")
    const id = extractThemeId(gid);

    mainThemeIdCache.set(context.session.shop, { gid, id });

    return { gid, id };
}

/**
 *
 * @param graphql
 * @param gid
 * @param templates
 * @returns
 */
async function getTemplateFiles(
    graphql: AuthenticatedContext["admin"]["graphql"],
    gid: string,
    templates: string[]
) {
    const response = await graphql(getFilesQuery, {
        variables: {
            themeId: gid,
            filenames: templates,
        },
    });
    const {
        data: { theme },
    } = await response.json();
    const jsonTemplateFiles: ThemeFile[] = theme?.files?.nodes ?? [];

    const jsonTemplateData = jsonTemplateFiles.map((file: ThemeFile) => {
        return {
            filename: file.filename,
            body: jsonc_parse(file.body?.content ?? ""),
        };
    });

    return jsonTemplateData;
}

/**
 * Enumerate every theme file whose filename matches one of the given wildcard
 * patterns (e.g. `sections/*.json`). Handles cursor pagination internally —
 * Shopify may return fewer files than requested per page to respect payload
 * limits, so we loop until `hasNextPage` is false.
 */
async function getTemplateFilesMatching(
    graphql: AuthenticatedContext["admin"]["graphql"],
    gid: string,
    patterns: string[]
) {
    const results: Array<{ filename: string; body: unknown }> = [];
    let cursor: string | null = null;
    let hasNextPage = true;

    while (hasNextPage) {
        const response = await graphql(getFilesPaginatedQuery, {
            variables: {
                themeId: gid,
                filenames: patterns,
                cursor,
            },
        });
        const json = (await response.json()) as {
            data?: {
                theme?: {
                    files?: {
                        nodes?: ThemeFile[];
                        pageInfo?: {
                            hasNextPage: boolean;
                            endCursor: string | null;
                        };
                    };
                };
            };
        };
        const theme = json?.data?.theme;
        const nodes = theme?.files?.nodes ?? [];
        const pageInfo = theme?.files?.pageInfo;

        for (const file of nodes) {
            results.push({
                filename: file.filename,
                body: jsonc_parse(file.body?.content ?? ""),
            });
        }

        hasNextPage = Boolean(pageInfo?.hasNextPage);
        cursor = pageInfo?.endCursor ?? null;
    }

    return results;
}

/**
 * Check if the current shop theme support blocks
 */
export async function doesThemeSupportBlock(
    context: AuthenticatedContext
): Promise<boolean> {
    try {
        // Get the main theme id
        const mainThemeId = await getMainThemeId(context);

        // Retrieve the JSON templates that we want to integrate with
        const jsonTemplateData = await getTemplateFiles(
            context.admin.graphql,
            mainThemeId.gid,
            ["templates/product.json"]
        );

        // Retrieve the body of JSON templates and find what section is set as
        // `main`. Vintage / non-OS-2.0 themes have no `templates/product.json`
        // (or it carries no `sections`), so guard every dereference.
        const templateMainSections = jsonTemplateData.flatMap(
            (file: ThemeFile) => {
                const sections = file.body?.sections;
                if (!sections || typeof sections !== "object") {
                    return [];
                }
                const main = Object.entries(sections).find(([id, section]) =>
                    typeof section !== "string"
                        ? id === "main" || section.type?.startsWith("main-")
                        : false
                );
                if (main && typeof main[1] !== "string" && main[1].type) {
                    return [`sections/${main[1].type}.liquid`];
                }
                return [];
            }
        );

        // No main section resolved → nothing to integrate with, so the theme
        // does not support app blocks.
        if (templateMainSections.length === 0) {
            return false;
        }

        const response = await context.admin.graphql(getFilesQuery, {
            variables: {
                themeId: mainThemeId.gid,
                filenames: templateMainSections,
            },
        });
        const {
            data: { theme: themeSectionFiles },
        } = await response.json();
        const sectionFiles: ThemeFile[] = themeSectionFiles?.files?.nodes ?? [];

        const sectionsWithAppBlock = sectionFiles
            .map((file: ThemeFile) =>
                file.body?.content && detectAppBlockSupport(file.body.content)
                    ? file
                    : null
            )
            .filter((section: ThemeFile | null) => section);

        if (
            jsonTemplateData.length > 0 &&
            jsonTemplateData.length === sectionsWithAppBlock.length
        ) {
            console.log(
                "All desired templates have main sections that support app blocks!"
            );
        } else if (sectionsWithAppBlock.length) {
            console.log(
                "Only some of the desired templates support app blocks."
            );
        } else {
            console.log("None of the desired templates support app blocks");
        }

        return sectionsWithAppBlock.length > 0;
    } catch (error) {
        // A custom theme can be shaped in ways we don't expect. Never let a
        // detection failure take down the whole admin route — treat it as
        // "blocks not supported" so the merchant can still reach the setup UI.
        console.error("doesThemeSupportBlock failed", error);
        return false;
    }
}

/**
 * Check whether the current theme can render app embed blocks (theme app
 * extensions injected via `content_for_header`). App embeds work on *all* theme
 * architectures — including vintage themes like Debut — as long as
 * `layout/theme.liquid` renders `{{ content_for_header }}`, which is where
 * Shopify injects the app embed markup.
 *
 * This is the signal that separates a usable "intermediate" theme (embed OK, no
 * app block) from a genuinely unsupported theme that needs the fully-manual SDK
 * snippet.
 */
export async function doesThemeSupportAppEmbed(
    context: AuthenticatedContext
): Promise<boolean> {
    try {
        const mainThemeId = await getMainThemeId(context);
        const response = await context.admin.graphql(getFilesQuery, {
            variables: {
                themeId: mainThemeId.gid,
                filenames: ["layout/theme.liquid"],
            },
        });
        const {
            data: { theme },
        } = await response.json();
        const body = theme?.files?.nodes?.[0]?.body;
        // The Theme Files API may return the body as text (`content`) OR base64
        // (`contentBase64`) — Shopify chooses per file, and .liquid layouts can
        // come back base64. Reading only `content` was silently yielding "" on
        // themes like Debut, hiding the Listener step.
        const content: string =
            body?.content ??
            (body?.contentBase64
                ? Buffer.from(body.contentBase64, "base64").toString("utf-8")
                : "");
        // Couldn't read theme.liquid at all (empty/missing) — don't hide the
        // near-universal app embed step; assume the theme supports it.
        if (!content) return true;
        return content.includes("content_for_header");
    } catch (error) {
        // App embeds work on virtually every theme (OS 2.0 AND vintage). Fail
        // OPEN so a transient detection error never hides the Listener
        // onboarding step — showing a step the rare broken theme can't use is
        // far better than silently skipping the critical Listener activation.
        console.error("doesThemeSupportAppEmbed failed", error);
        return true;
    }
}

export interface ThemeBlockInfo {
    type: string;
    disabled?: boolean;
    settings?: Record<string, unknown>;
}

/**
 * Extract numeric theme ID from a Shopify GID.
 */
export function extractThemeId(gid: string): string {
    const match = gid.match(/\d+$/);
    return match ? match[0] : "";
}

/**
 * Detect if a Frak listener block is enabled in theme settings_data blocks.
 */
export function detectFrakActivated(
    blocks: Record<string, ThemeBlockInfo> | undefined
): boolean {
    if (!blocks) return false;
    const typeMatch = "/blocks/listener/";
    return !!Object.entries(blocks).find(
        ([_id, info]) => info.type?.includes(typeMatch) && !info.disabled
    );
}

/**
 * Block type pattern for the Frak share button.
 * Matches `block.type` strings like `shopify://apps/frak/blocks/referral_button/<uuid>`.
 */
const FRAK_BUTTON_BLOCK_PATTERN = "/blocks/referral_button/";

/**
 * Detect if any section in the product template contains a Frak referral button
 * block.
 *
 * Shopify places app blocks in a dedicated `"apps"` section (not inside
 * the `"main"` product section), so we scan the `blocks` map of every
 * section.
 */
export function detectFrakButton(
    sections:
        | Record<
              string,
              | string
              | {
                    type: string;
                    block_order?: string[];
                    blocks?: Record<string, ThemeBlockInfo>;
                }
          >
        | undefined
): boolean {
    if (!sections) return false;
    return Object.values(sections).some(
        (section) =>
            typeof section !== "string" &&
            section.blocks &&
            Object.values(section.blocks).some(
                (block) =>
                    block.type?.includes(FRAK_BUTTON_BLOCK_PATTERN) &&
                    !block.disabled
            )
    );
}

/**
 * Detect if any section in settings_data.json contains a Frak banner block.
 *
 * When a merchant adds the banner app block to a theme-wide section (e.g.
 * header/footer), it appears under `current.sections[sectionId].blocks`
 * in `config/settings_data.json`.
 */
export function detectFrakBannerInSections(
    sections:
        | Record<
              string,
              | string
              | {
                    type: string;
                    block_order?: string[];
                    blocks?: Record<string, ThemeBlockInfo>;
                }
          >
        | undefined
): boolean {
    if (!sections) return false;
    return Object.values(sections).some(
        (section) =>
            typeof section !== "string" &&
            section.blocks &&
            Object.values(section.blocks).some(
                (block) =>
                    block.type?.includes("/blocks/banner/") && !block.disabled
            )
    );
}

/**
 * Detect if a Liquid section's schema declares an @app block type.
 */
export function detectAppBlockSupport(liquidContent: string): boolean {
    const match = liquidContent.match(
        /\{%\s+schema\s+%\}([\s\S]*?)\{%\s+endschema\s+%\}/m
    );
    if (!match) return false;
    const schema = jsonc_parse(match[1]);
    if (schema?.blocks) {
        return schema.blocks.some((b: { type: string }) => b.type === "@app");
    }
    return false;
}

/**
 * Check if the current shop theme has the Frak app activated
 */
export async function doesThemeHasFrakActivated(context: AuthenticatedContext) {
    // Get the main theme id
    const mainThemeId = await getMainThemeId(context);

    // Retrieve the JSON templates that we want to integrate with
    const jsonTemplateData = await getTemplateFiles(
        context.admin.graphql,
        mainThemeId.gid,
        ["config/settings_data.json"]
    );

    if (
        jsonTemplateData.length <= 0 ||
        !jsonTemplateData?.[0]?.body?.current?.blocks
    ) {
        return false;
    }

    return detectFrakActivated(
        jsonTemplateData[0].body.current.blocks as Record<
            string,
            ThemeBlockInfo
        >
    );
}

/**
 * Check if the current shop theme has the Frak share button (referral_button)
 * in the product template.
 */
export async function doesThemeHasFrakButton(context: AuthenticatedContext) {
    const mainThemeId = await getMainThemeId(context);

    const jsonTemplateData = await getTemplateFiles(
        context.admin.graphql,
        mainThemeId.gid,
        ["templates/product.json"]
    );

    const productFile = jsonTemplateData.find(
        (f: ThemeFile) => f.filename === "templates/product.json"
    );

    // `body` is undefined when jsonc_parse received an empty/missing file, and
    // vintage themes have no `sections` — detectFrakButton guards both.
    return detectFrakButton(productFile?.body?.sections);
}

/**
 * Check if the current shop theme has the Frak banner block enabled anywhere.
 *
 * Enumerates every section group (`sections/*.json`), every template
 * (`templates/*.json`), and `config/settings_data.json` via the Shopify Admin
 * GraphQL API, then scans each file for an enabled Frak banner app block.
 * This catches banners placed in the header, footer, any custom section group,
 * or directly on a page template.
 */
export async function doesThemeHasFrakBanner(context: AuthenticatedContext) {
    const mainThemeId = await getMainThemeId(context);

    const files = await getTemplateFilesMatching(
        context.admin.graphql,
        mainThemeId.gid,
        ["sections/*.json", "templates/*.json", "config/settings_data.json"]
    );

    return files.some((file) => {
        const body = file.body as
            | {
                  sections?: unknown;
                  current?: { sections?: unknown };
              }
            | undefined;
        // settings_data.json stores sections under body.current.sections,
        // section groups and templates store them directly under body.sections.
        const sections =
            file.filename === "config/settings_data.json"
                ? body?.current?.sections
                : body?.sections;

        return detectFrakBannerInSections(
            sections as
                | Record<
                      string,
                      | string
                      | {
                            type: string;
                            block_order?: string[];
                            blocks?: Record<string, ThemeBlockInfo>;
                        }
                  >
                | undefined
        );
    });
}
