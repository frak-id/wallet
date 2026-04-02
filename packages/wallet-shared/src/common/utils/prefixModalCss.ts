/**
 * Prefixes a CSS class with the modal global CSS.
 *
 * @param name The name of the CSS class.
 * @returns The prefixed CSS class.
 */
export function prefixModalCss(name: string) {
    return `nexus-modal-${name}`;
}
