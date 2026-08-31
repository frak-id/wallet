import { isHostEmbedded } from "@/module/common/utils/hostEmbed";

/**
 * Tag the document when a native host owns the window, so the stylesheet can
 * drop its tablet centering. Called before the first render, like Tauri does in
 * `index.html`; a host's sheet is full-bleed at every width.
 */
export function markHostEmbedded(embed: unknown) {
    if (!isHostEmbedded(embed)) return;
    document.documentElement.setAttribute("data-embed", "native");
}
