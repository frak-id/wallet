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
    const jsonTemplateFiles = theme?.files?.nodes;

    const jsonTemplateData = jsonTemplateFiles.map((file: ThemeFile) => {
        return {
            filename: file.filename,
            body: jsonc_parse(file.body.content),
        };
    });

    return jsonTemplateData;
}

/**
 * Check if the current shop theme support blocks
 */
export async function doesThemeSupportBlock(context: AuthenticatedContext) {
    // Get the main theme id
    const mainThemeId = await getMainThemeId(context);

    // Retrieve the JSON templates that we want to integrate with
    const jsonTemplateData = await getTemplateFiles(
        context.admin.graphql,
        mainThemeId.gid,
        ["templates/product.json"]
    );

    // Retrieve the body of JSON templates and find what section is set as `main`
    const templateMainSections = jsonTemplateData.flatMap((file: ThemeFile) => {
        const main = Object.entries(file.body.sections).find(([id, section]) =>
            typeof section !== "string"
                ? id === "main" || section.type.startsWith("main-")
                : false
        );
        if (main && typeof main[1] !== "string" && main[1].type) {
            return [`sections/${main[1].type}.liquid`];
        }
        return [];
    });

    const response = await context.admin.graphql(getFilesQuery, {
        variables: {
            themeId: mainThemeId.gid,
            filenames: templateMainSections,
        },
    });
    const {
        data: { theme: themeSectionFiles },
    } = await response.json();
    const sectionFiles = themeSectionFiles?.files?.nodes;

    const sectionsWithAppBlock = sectionFiles
        .map((file: ThemeFile) =>
            detectAppBlockSupport(file.body.content) ? file : null
        )
        .filter((section: string | null) => section);

    if (
        jsonTemplateData.length > 0 &&
        jsonTemplateData.length === sectionsWithAppBlock.length
    ) {
        console.log(
            "All desired templates have main sections that support app blocks!"
        );
    } else if (sectionsWithAppBlock.length) {
        console.log("Only some of the desired templates support app blocks.");
    } else {
        console.log("None of the desired templates support app blocks");
    }

    return true;
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
        ([_id, info]) => info.type.includes(typeMatch) && !info.disabled
    );
}

/**
 * Section-targeted Frak block types detected in template block_order arrays.
 */
const FRAK_SECTION_BLOCKS = ["referral_button", "post_purchase"] as const;

/**
 * Body-targeted Frak block type patterns detected in settings_data.json blocks.
 */
const FRAK_BODY_BLOCK_PATTERNS = ["/blocks/banner/"] as const;

/**
 * Detect if any main product section contains a Frak component block
 * (referral_button or post_purchase).
 */
export function detectFrakButton(
    sections: Record<string, string | { type: string; block_order?: string[] }>
): boolean {
    const main = Object.entries(sections).find(([id, section]) =>
        typeof section !== "string"
            ? id === "main" || section.type.startsWith("main-")
            : false
    );
    if (main && typeof main[1] !== "string" && main[1].block_order) {
        return main[1].block_order.some((blockId) =>
            FRAK_SECTION_BLOCKS.some((type) => blockId.includes(type))
        );
    }
    return false;
}

/**
 * Detect if settings_data.json blocks contain a body-targeted Frak component
 * (e.g. banner). Similar to {@link detectFrakActivated} but for non-listener blocks.
 */
export function detectFrakBodyComponent(
    blocks: Record<string, ThemeBlockInfo> | undefined
): boolean {
    if (!blocks) return false;
    return !!Object.entries(blocks).find(
        ([_id, info]) =>
            FRAK_BODY_BLOCK_PATTERNS.some((pattern) =>
                info.type.includes(pattern)
            ) && !info.disabled
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
 * Check if the current shop theme has any Frak component block.
 *
 * Checks two sources:
 * - `templates/product.json` for section-targeted blocks (referral_button, post_purchase)
 * - `config/settings_data.json` for body-targeted blocks (banner)
 */
export async function doesThemeHasFrakButton(context: AuthenticatedContext) {
    const mainThemeId = await getMainThemeId(context);

    // Fetch both template sources in a single GraphQL call
    const jsonTemplateData = await getTemplateFiles(
        context.admin.graphql,
        mainThemeId.gid,
        ["templates/product.json", "config/settings_data.json"]
    );

    const productFile = jsonTemplateData.find(
        (f: ThemeFile) => f.filename === "templates/product.json"
    );
    const settingsFile = jsonTemplateData.find(
        (f: ThemeFile) => f.filename === "config/settings_data.json"
    );

    // Check section blocks in product template (referral_button, post_purchase)
    const hasSectionBlock = productFile
        ? detectFrakButton(productFile.body.sections)
        : false;

    // Check body blocks in settings data (banner)
    const hasBodyBlock = detectFrakBodyComponent(
        settingsFile?.body?.current?.blocks as
            | Record<string, ThemeBlockInfo>
            | undefined
    );

    return hasSectionBlock || hasBodyBlock;
}
