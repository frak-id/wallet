/**
 * Prefixes a CSS class with the wallet global CSS.
 *
 * @param name The name of the CSS class.
 * @returns The prefixed CSS class.
 */
export function prefixWalletCss(name: string) {
    return `frak-wallet-${name}`;
}
