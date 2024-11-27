import { parse as jsonc_parse } from "jsonc-parser";
import type { AuthenticatedContext } from "../types/context";

type ThemeFile = {
    filename: string;
    body: {
        content: string;
        sections: { id: string; section: { type: string } };
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
 * Check if the current shop theme support blocks
 */
export async function doesThemeSupportBlock({
    admin: { graphql },
}: AuthenticatedContext) {
    // Get the main theme id
    let response = await graphql(`
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
    const themeId = themes?.nodes?.[0]?.id;

    if (!themeId) {
        console.warn("No main theme found");
        return false;
    }

    // Retrieve the JSON templates that we want to integrate with
    const APP_BLOCK_TEMPLATES = [/*"index",*/ "product"];
    response = await graphql(getFilesQuery, {
        variables: {
            themeId: themeId,
            filenames: APP_BLOCK_TEMPLATES.map((f) => `templates/${f}.json`),
        },
    });
    const {
        data: { theme },
    } = await response.json();
    const jsonTemplateFiles = theme?.files?.nodes;
    if (
        jsonTemplateFiles?.length > 0 &&
        jsonTemplateFiles?.length === APP_BLOCK_TEMPLATES.length
    ) {
        console.log("All desired templates support sections everywhere!");
    } else if (jsonTemplateFiles?.length) {
        console.warn(
            "Only some of the desired templates support sections everywhere."
        );
        // return false;
    }
    const jsonTemplateData = jsonTemplateFiles.map((file: ThemeFile) => {
        return {
            filename: file.filename,
            body: jsonc_parse(file.body.content),
        };
    });

    // Retrieve the body of JSON templates and find what section is set as `main`
    const templateMainSections = jsonTemplateData
        .map((file: ThemeFile) => {
            const main = Object.entries(file.body.sections).find(
                ([id, section]) =>
                    typeof section !== "string"
                        ? id === "main" || section.type.startsWith("main-")
                        : false
            );
            if (main && typeof main[1] !== "string" && main[1].type) {
                return `sections/${main[1].type}.liquid`;
            }
        })
        .filter((section: string | null) => section);

    response = await graphql(getFilesQuery, {
        variables: {
            themeId: themeId,
            filenames: templateMainSections,
        },
    });
    const {
        data: { theme: themeSectionFiles },
    } = await response.json();
    const sectionFiles = themeSectionFiles?.files?.nodes;

    const sectionsWithAppBlock = sectionFiles
        .map((file: ThemeFile) => {
            let acceptsAppBlock = false;
            const match = file.body.content.match(
                /\{\%\s+schema\s+\%\}([\s\S]*?)\{\%\s+endschema\s+\%\}/m
            );
            if (match) {
                const schema = jsonc_parse(match[1]);
                if (schema?.blocks) {
                    acceptsAppBlock = schema.blocks.some(
                        (b: { type: string }) => b.type === "@app"
                    );
                }
            }
            return acceptsAppBlock ? file : null;
        })
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
