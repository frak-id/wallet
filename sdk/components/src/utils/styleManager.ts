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

function injectBase(tag: string, css: string): void {
    ensureStyle(`frak-base-${tag}`, css);
}

function injectPlacement(placementId: string, scopedCss: string): void {
    ensureStyle(`frak-placement-${placementId}`, scopedCss);
}

export const styleManager = { injectBase, injectPlacement };
