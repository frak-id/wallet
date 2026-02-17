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
 * Detect if any main product section contains a referral_button block.
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
            blockId.includes("referral_button")
        );
    }
    return false;
}

/**
 * Detect if a Frak wallet_button block is enabled. Returns block ID or null.
 */
export function detectWalletButton(
    blocks: Record<string, ThemeBlockInfo> | undefined
): string | null {
    if (!blocks) return null;
    const typeMatch = "/blocks/wallet_button/";
    const walletBlock = Object.entries(blocks).find(
        ([_id, info]) => info.type.includes(typeMatch) && !info.disabled
    );
    if (walletBlock) {
        const [_, blockInfo] = walletBlock;
        const idMatch = blockInfo.type.match(/wallet_button\/([^/]+)$/);
        return idMatch ? idMatch[1] : null;
    }
    return null;
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
 * Check if the current shop theme has the Frak button in product page
 */
export async function doesThemeHasFrakButton(context: AuthenticatedContext) {
    // Get the main theme id
    const mainThemeId = await getMainThemeId(context);

    // Retrieve the JSON templates that we want to integrate with
    const jsonTemplateData = await getTemplateFiles(
        context.admin.graphql,
        mainThemeId.gid,
        ["templates/product.json"]
    );

    // Retrieve the body of JSON templates and find what section is set as `main`
    // Return true if any of the main sections has a block with the frak_referral_button type
    return jsonTemplateData.some((file: ThemeFile) =>
        detectFrakButton(file.body.sections)
    );
}

/**
 * Check if the current shop theme has the Frak wallet button in body
 */
export async function doesThemeHasFrakWalletButton(
    context: AuthenticatedContext
) {
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
        return null;
    }

    return detectWalletButton(
        jsonTemplateData[0].body.current.blocks as Record<
            string,
            ThemeBlockInfo
        >
    );
}
