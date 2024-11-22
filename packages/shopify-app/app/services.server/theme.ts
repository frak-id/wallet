import type { AuthenticatedContext } from "../types/context";

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
    const APP_BLOCK_TEMPLATES = ["index", "product"];
    response = await graphql(
        `
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
`,
        {
            variables: {
                themeId: themeId,
                filenames: APP_BLOCK_TEMPLATES.map(
                    (f) => `templates/${f}.json`
                ),
            },
        }
    );
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
        return false;
    }

    // todo: Additional checks to ensure the theme supports blocks?? -> https://shopify.dev/docs/apps/build/online-store/verify-support
    return true;
}
