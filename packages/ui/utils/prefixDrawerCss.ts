/**
 * Prefixes a CSS class with the drawer global CSS.
 *
 * @param name The name of the CSS class.
 * @returns The prefixed CSS class.
 */
export function prefixDrawerCss(name: string) {
    return `nexus-drawer-${name}`;
}
