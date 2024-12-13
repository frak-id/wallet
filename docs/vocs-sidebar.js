import { writeFileSync } from "node:fs";
import path from "node:path";
import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/**
 * @param {import('typedoc-plugin-markdown').MarkdownApplication} app
 */
export function load(app) {
    /**
     * Slugify each anchor reference in the final markdown generated
     */
    app.renderer.on(MarkdownPageEvent.END, (page) => {
        page.contents = page.contents?.replace(
            /\[([^\]]+)\]\((?!https?:|\/|\.)([^)]*#?[^)]*)\)/g,
            (_match, text, url) => {
                const urlWithAnchor = url.split("#");
                if (urlWithAnchor.length > 1) {
                    const anchorPart = slugifyAnchor(urlWithAnchor[1]);
                    return `[${text}](${encodeURI(`${urlWithAnchor[0]}#${anchorPart}`)})`;
                }
                return `[${text}](${encodeURI(url)})`;
            }
        );
    });

    /**
     * Generate the sidebar ts file
     */
    app.renderer.postRenderAsyncJobs.push(async (output) => {
        if (!output.navigation) return;

        const outDir = app.options.getValue("out");
        const basePath = app.options.getValue("publicPath");
        const sidebarPath = path.resolve(outDir, "references-sidebar.json");

        const sidebar = output.navigation.map((navigationItem) =>
            getNavigationItem(navigationItem, basePath)
        );
        writeFileSync(sidebarPath, JSON.stringify(sidebar, null, 4));
    });
}

/**
 * Helper to slugify the anchor
 *  - From https://github.com/typedoc2md/typedoc-plugin-markdown/blob/5bd12c8670969726095417413bac5ab69efd12b5/packages/typedoc-vitepress-theme/src/utils/utils.ts#L6
 * @param str
 */
export const slugifyAnchor = (str) =>
    str
        .normalize("NFKD")
        // Remove accents
        // biome-ignore lint/suspicious/noMisleadingCharacterClass: False positive
        .replace(/[\u0300-\u036F]/g, "")
        // Remove control characters
        // biome-ignore lint/suspicious/noControlCharactersInRegex: Exactly what we want to do, remove control char from the text
        .replace(/[\u0000-\u001f]/g, "")
        // Replace special characters
        .replace(/[\s~`!@#$%^&*()\-_+=[\]{}|\\;:"'“”‘’<>,.?/]+/g, "-")
        // Remove continuos separators
        .replace(/-{2,}/g, "-")
        // Remove prefixing and trailing separators
        .replace(/^-+|-+$/g, "")
        // ensure it doesn't start with a number (#121)
        .replace(/^(\d)/, "_$1")
        // lowercase
        .toLowerCase();

/**
 * @param {import('typedoc-plugin-markdown').NavigationItem} navigationItem
 * @param {string} basePath
 */
function getNavigationItem(navigationItem, basePath) {
    const hasChildren = navigationItem?.children?.length;

    const linkParts = [];

    if (navigationItem?.path) {
        if (basePath.length) {
            linkParts.push(basePath);
        }
        linkParts.push(
            getParsedUrl(navigationItem.path)
                .replace(/\\/g, "/")
                .replace(".mdx", "")
        );
    }

    // Get all the childrens of the navigation item
    let items = navigationItem.children?.map((group) =>
        getNavigationItem(group, basePath)
    );

    // If it only has one items, and this items has sub items, directly use the sub items
    if (items?.length === 1 && items[0].items) {
        items = items[0].items;
    }

    return {
        text: navigationItem.title,
        ...(linkParts.length && {
            link: `${linkParts.join("/")}`,
        }),
        items,
        // All navigation are collapsed by default
        ...(hasChildren && { collapsed: true }),
    };
}

function getParsedUrl(url) {
    if (path.basename(url) === "index.md") {
        return `${path.dirname(url)}/`;
    }
    return url;
}
