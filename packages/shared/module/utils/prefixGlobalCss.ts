const PREFIX_CSS = "nexus-modal";

/**
 * Prefixes a CSS class with the global CSS prefix.
 *
 * @param name The name of the CSS class.
 * @returns The prefixed CSS class.
 */
export function prefixGlobalCss(name: string) {
    return `${PREFIX_CSS}-${name}`;
}
