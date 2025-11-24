// @ts-check
import { ReflectionKind } from "typedoc";
import { MarkdownPageEvent } from "typedoc-plugin-markdown";

/**
 * @param {import('typedoc-plugin-markdown').MarkdownApplication} app
 */
export function load(app) {
    // Get the generation data that will be pushed in the header (year-month-day)
    const date = new Date();
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const dateStr = `${year}-${month}-${day}`;

    // The modal kind we want
    const targetModelKink = [
        ReflectionKind.Variable,
        ReflectionKind.TypeAlias,
        ReflectionKind.Function,
    ];

    app.renderer.on(
        MarkdownPageEvent.BEGIN,
        /** @param {import('typedoc-plugin-markdown').MarkdownPageEvent} page */
        (page) => {
            // Set the frontmatter options depending on the model kind
            if (targetModelKink.includes(page.model?.kind)) {
                // Extract group from comment tags if available
                const groupTag = page.model?.comment?.blockTags?.find(
                    (tag) => tag.tag === "@group"
                );
                let groupName = groupTag?.content?.[0]?.text?.trim();

                // If no group found in block tags, check if model.parent has group information
                if (!groupName && page.model?.parent?.groups) {
                    // Find which group this model belongs to
                    const parentGroup = page.model.parent.groups.find((g) =>
                        g.children?.some((child) => child.id === page.model.id)
                    );
                    if (parentGroup) {
                        groupName = parentGroup.title;
                    }
                }

                // Try to get group from page.group as additional fallback
                const fallbackGroup = page.group;

                // Determine final group name
                const finalGroupName = groupName || fallbackGroup;

                // Build title: "Group - Name" if group exists, otherwise just "Name"
                const title = finalGroupName
                    ? `${finalGroupName} - ${page.model?.name}`
                    : page.model?.name;

                // Set custom front matter options here
                page.frontmatter = {
                    // Add a few options to the frontmatter section
                    title: title,
                    date: dateStr,
                    // spread the existing frontmatter
                    ...page.frontmatter,
                };
            }
        }
    );
}
