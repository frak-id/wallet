import { micromark } from "micromark";
import { useMemo } from "react";
import { jsx } from "react/jsx-runtime";

export function Markdown({
    md,
    defaultTxt,
}: { md?: string; defaultTxt?: string }) {
    return useMemo(() => {
        // Convert to markdown
        let html = micromark(md ?? defaultTxt ?? "No description", {
            allowDangerousHtml: false,
        });
        // Post-processing, add target=_blank to every link in the markdown
        html = html.replace(/<a /g, '<a target="_blank" ');
        // Convert to component
        return jsx("div", { dangerouslySetInnerHTML: { __html: html } });
    }, [md, defaultTxt]);
}
