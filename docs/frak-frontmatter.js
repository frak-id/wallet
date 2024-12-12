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
                // Find a description that match it
                const description =
                    page.model?.comment?.description ??
                    page.model?.comment?.shortText;

                // Set custom front matter options here
                page.frontmatter = {
                    // Add a few options to the frontmatter section
                    title: `${page.group} - ${page.model?.name}`,
                    description,
                    date: dateStr,
                    // spread the existing frontmatter
                    ...page.frontmatter,
                };
            }
        }
    );
}
