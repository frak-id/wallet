export function sanitizeCss(css: string): string {
    return css
        .replace(/@import\b[^;]*;?/gi, "")
        .replace(/url\s*\([^)]*\)/gi, "url()");
}
