import { transform } from "lightningcss";

const cssTargets = {
    chrome: 100 << 16,
    safari: 14 << 16,
    firefox: 91 << 16,
};

const securityVisitor = {
    Rule: {
        import() {
            return [];
        },
    },
    Url(url: { url: string }) {
        return { ...url, url: "" };
    },
} as const;

/**
 * Sanitize and minify merchant-provided CSS using LightningCSS AST visitors.
 *
 * Security: strips @import rules and neutralizes url() values to prevent
 * external resource loading from merchant-injected CSS.
 *
 * Returns empty string on parse failure rather than broken CSS.
 */
export function processCss(rawCss: string): string {
    try {
        const result = transform({
            filename: "placement.css",
            code: Buffer.from(rawCss),
            minify: true,
            errorRecovery: true,
            targets: cssTargets,
            visitor: securityVisitor,
        });
        return new TextDecoder().decode(result.code);
    } catch {
        return "";
    }
}

// Wraps CSS in a nesting block so LightningCSS compiles it to scoped flat selectors.
// e.g. `.button { color: red }` → `frak-button-share[placement="hero"] .button{color:red}`
export function processScopedCss(
    rawCss: string,
    scopeSelector: string
): string {
    return processCss(`${scopeSelector} { ${rawCss} }`);
}
