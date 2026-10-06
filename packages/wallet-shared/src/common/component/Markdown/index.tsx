import { Markdown as TanstackMarkdown } from "@tanstack/markdown/react";
import type { ComponentProps } from "react";

const components = {
    a: (props: ComponentProps<"a">) => (
        <a {...props} target="_blank" rel="noopener noreferrer" />
    ),
};

export function Markdown({ md }: { md?: string }) {
    return (
        <div>
            <TanstackMarkdown
                frontmatter={false}
                headingIds={false}
                components={components}
            >
                {md ?? "No description"}
            </TanstackMarkdown>
        </div>
    );
}
