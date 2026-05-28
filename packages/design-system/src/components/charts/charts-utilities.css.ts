import { globalStyle } from "@vanilla-extract/css";

// Scoped reimplementation of the Tailwind utility classes the vendored bklit
// chart files reference. Everything is scoped under `.frak-chart` (applied to
// each chart root + the tooltip portal container) so these never leak into the
// rest of the app. Class names are kept verbatim from the bklit source.
const R = ".frak-chart";

// Utilities that sit on the chart root element itself (which also carries
// `.frak-chart`). The descendant selectors below don't match the root, so
// these self-combined rules give it positioning/sizing context — without
// `position: relative` here, the absolutely-positioned axis labels escape
// the chart and leak onto the page.
globalStyle(`${R}.relative`, { position: "relative" });
globalStyle(`${R}.w-full`, { width: "100%" });
globalStyle(`${R}.aspect-square`, { aspectRatio: "1 / 1" });
globalStyle(`${R}.flex`, { display: "flex" });
globalStyle(`${R}.items-center`, { alignItems: "center" });
globalStyle(`${R}.justify-center`, { justifyContent: "center" });

// ── Position / display ──
globalStyle(`${R} .relative`, { position: "relative" });
globalStyle(`${R} .absolute`, { position: "absolute" });
globalStyle(`${R} .grid`, { display: "grid" });
globalStyle(`${R} .flex`, { display: "flex" });
globalStyle(`${R} .inset-0`, { inset: 0 });
globalStyle(`${R} .top-0`, { top: 0 });
globalStyle(`${R} .bottom-0`, { bottom: 0 });
globalStyle(`${R} .right-0`, { right: 0 });
globalStyle(`${R} .z-50`, { zIndex: 50 });

// ── Flexbox ──
globalStyle(`${R} .flex-col`, { flexDirection: "column" });
globalStyle(`${R} .flex-1`, { flex: "1 1 0%" });
globalStyle(`${R} .shrink-0`, { flexShrink: 0 });
globalStyle(`${R} .items-center`, { alignItems: "center" });
globalStyle(`${R} .items-end`, { alignItems: "flex-end" });
globalStyle(`${R} .justify-center`, { justifyContent: "center" });
globalStyle(`${R} .justify-end`, { justifyContent: "flex-end" });
globalStyle(`${R} .justify-between`, { justifyContent: "space-between" });
globalStyle(`${R} .gap-1`, { gap: "0.25rem" });
globalStyle(`${R} .gap-1\\.5`, { gap: "0.375rem" });
globalStyle(`${R} .gap-2`, { gap: "0.5rem" });
globalStyle(`${R} .gap-4`, { gap: "1rem" });
globalStyle(`${R} .space-y-1\\.5 > * + *`, { marginTop: "0.375rem" });
globalStyle(`${R} .aspect-square`, { aspectRatio: "1 / 1" });

// ── Sizing ──
globalStyle(`${R} .w-full`, { width: "100%" });
globalStyle(`${R} .h-full`, { height: "100%" });
globalStyle(`${R} .h-6`, { height: "1.5rem" });
globalStyle(`${R} .h-12`, { height: "3rem" });
globalStyle(`${R} .w-12`, { width: "3rem" });
globalStyle(`${R} .h-2\\.5`, { height: "0.625rem" });
globalStyle(`${R} .w-2\\.5`, { width: "0.625rem" });
globalStyle(`${R} .min-w-\\[140px\\]`, { minWidth: "140px" });

// ── Spacing ──
globalStyle(`${R} .pr-2`, { paddingRight: "0.5rem" });
globalStyle(`${R} .px-3`, { paddingLeft: "0.75rem", paddingRight: "0.75rem" });
globalStyle(`${R} .px-4`, { paddingLeft: "1rem", paddingRight: "1rem" });
globalStyle(`${R} .py-1`, { paddingTop: "0.25rem", paddingBottom: "0.25rem" });
globalStyle(`${R} .py-2\\.5`, {
    paddingTop: "0.625rem",
    paddingBottom: "0.625rem",
});
globalStyle(`${R} .mb-2`, { marginBottom: "0.5rem" });
globalStyle(`${R} .mt-0\\.5`, { marginTop: "0.125rem" });
globalStyle(`${R} .mt-2`, { marginTop: "0.5rem" });

// ── Typography ──
globalStyle(`${R} .text-xs`, { fontSize: "0.75rem", lineHeight: "1rem" });
globalStyle(`${R} .text-sm`, { fontSize: "0.875rem", lineHeight: "1.25rem" });
globalStyle(`${R} .text-right`, { textAlign: "right" });
globalStyle(`${R} .whitespace-nowrap`, { whiteSpace: "nowrap" });
globalStyle(`${R} .truncate`, {
    overflow: "hidden",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
});
globalStyle(`${R} .font-medium`, { fontWeight: 500 });
globalStyle(`${R} .font-semibold`, { fontWeight: 600 });
globalStyle(`${R} .font-bold`, { fontWeight: 700 });
globalStyle(`${R} .tabular-nums`, { fontVariantNumeric: "tabular-nums" });

// ── Effects ──
globalStyle(`${R} .rounded-full`, { borderRadius: "9999px" });
globalStyle(`${R} .rounded-lg`, { borderRadius: "0.5rem" });
globalStyle(`${R} .overflow-hidden`, { overflow: "hidden" });
globalStyle(`${R} .overflow-visible`, { overflow: "visible" });
globalStyle(`${R} .shadow-lg`, {
    boxShadow:
        "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
});
globalStyle(`${R} .shadow-sm`, { boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)" });
globalStyle(`${R} .backdrop-blur-md`, { backdropFilter: "blur(12px)" });
globalStyle(`${R} .pointer-events-none`, { pointerEvents: "none" });
globalStyle(`${R} .select-none`, { userSelect: "none" });
globalStyle(`${R} .cursor-pointer`, { cursor: "pointer" });
globalStyle(`${R} .transition-opacity`, {
    transitionProperty: "opacity",
    transitionTimingFunction: "cubic-bezier(0.4, 0, 1, 1)",
    transitionDuration: "150ms",
});
globalStyle(`${R} .duration-200`, { transitionDuration: "200ms" });
globalStyle(`${R} .ease-out`, {
    transitionTimingFunction: "cubic-bezier(0, 0, 0.2, 1)",
});

// ── Colors (bridge to chart vars / theme) ──
globalStyle(`${R} .text-white`, { color: "#ffffff" });
globalStyle(`${R} .text-chart-label`, { color: "var(--chart-label)" });
globalStyle(`${R} .text-foreground`, { color: "var(--chart-foreground)" });
globalStyle(`${R} .text-muted-foreground`, {
    color: "var(--chart-foreground-muted)",
});
globalStyle(`${R} .bg-foreground`, {
    backgroundColor: "var(--chart-foreground)",
});
globalStyle(`${R} .text-background`, { color: "var(--chart-background)" });
globalStyle(`${R} .bg-muted\\/50`, {
    backgroundColor: "var(--chart-segment-background)",
});
globalStyle(`${R} .bg-chart-tooltip-background`, {
    backgroundColor: "var(--chart-tooltip-background)",
});
globalStyle(`${R} .text-chart-tooltip-foreground`, {
    color: "var(--chart-tooltip-foreground)",
});
globalStyle(`${R} .text-chart-tooltip-muted`, {
    color: "var(--chart-tooltip-muted)",
});
globalStyle(`${R} .bg-zinc-900`, { backgroundColor: "#18181b" });

// ── Dark-mode variants (Frak uses [data-theme='dark']) ──
globalStyle(`[data-theme='dark'] ${R} .dark\\:bg-zinc-100`, {
    backgroundColor: "#f4f4f5",
});
globalStyle(`[data-theme='dark'] ${R} .dark\\:text-zinc-900`, {
    color: "#18181b",
});
