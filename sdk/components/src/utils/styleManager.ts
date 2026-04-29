/**
 * Tracks every base CSS rule (by exact cssText) already injected into <head>.
 *
 * Each Light DOM component (frak-banner, frak-post-purchase, …) ships a
 * `cssSource` string that contains both component-specific rules AND shared
 * design-system rules (reset, sprinkles, theme tokens) pulled in transitively
 * by vanilla-extract. Without dedup, every component re-emits the same reset
 * class definitions in its own <style> tag, and whichever stylesheet is
 * appended LAST wins for those shared selectors — flipping the cascade order
 * non-deterministically across mount orders.
 *
 * Deduplicating rule-by-rule guarantees that shared rules appear exactly once
 * (in the first component's stylesheet) and component-specific rules always
 * come AFTER them in document order, so component styles win deterministically.
 */
const injectedRules = new Set<string>();

function ensureStyle(id: string, css: string): void {
    const existing = document.getElementById(id);
    if (existing) {
        if (existing.textContent !== css) {
            existing.textContent = css;
        }
        return;
    }
    const style = document.createElement("style");
    style.id = id;
    style.textContent = css;
    document.head.appendChild(style);
}

/**
 * Parses `css` and returns a new string containing only rules that have not
 * already been injected into <head>. Tracks injected rules in `injectedRules`.
 *
 * Falls back to the raw input if the browser lacks the constructable
 * `CSSStyleSheet` API or parsing fails — preserves correctness over dedup.
 */
function dedupeAgainstInjected(css: string): string {
    if (typeof CSSStyleSheet !== "function") return css;

    let sheet: CSSStyleSheet;
    try {
        sheet = new CSSStyleSheet();
        sheet.replaceSync(css);
    } catch {
        return css;
    }

    let out = "";
    for (let i = 0; i < sheet.cssRules.length; i++) {
        const ruleText = sheet.cssRules[i].cssText;
        if (injectedRules.has(ruleText)) continue;
        injectedRules.add(ruleText);
        out += `${ruleText}\n`;
    }
    return out;
}

function injectBase(tag: string, css: string): void {
    const id = `frak-base-${tag}`;
    // Idempotent: same tag is injected only once. cssSource is build-time
    // constant per component, so re-running the effect (StrictMode, HMR)
    // must not duplicate or wipe rules.
    if (document.getElementById(id)) return;

    const deduped = dedupeAgainstInjected(css);
    if (!deduped) return;

    const style = document.createElement("style");
    style.id = id;
    style.textContent = deduped;
    document.head.appendChild(style);
}

function injectPlacement(
    tag: string,
    placementId: string,
    scopedCss: string
): void {
    ensureStyle(`frak-placement-${tag}-${placementId}`, scopedCss);
}

export const styleManager = { injectBase, injectPlacement };
