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
globalStyle(`${R}.flex`, { display: "flex" });
globalStyle(`${R}.items-center`, { alignItems: "center" });
globalStyle(`${R}.justify-center`, { justifyContent: "center" });
globalStyle(`${R} .relative`, { position: "relative" });
globalStyle(`${R} .absolute`, { position: "absolute" });
globalStyle(`${R} .grid`, { display: "grid" });
globalStyle(`${R} .flex`, { display: "flex" });
globalStyle(`${R} .inset-0`, { inset: 0 });
globalStyle(`${R} .z-50`, { zIndex: 50 });
globalStyle(`${R} .flex-col`, { flexDirection: "column" });
globalStyle(`${R} .shrink-0`, { flexShrink: 0 });
globalStyle(`${R} .items-center`, { alignItems: "center" });
globalStyle(`${R} .justify-center`, { justifyContent: "center" });
globalStyle(`${R} .justify-between`, { justifyContent: "space-between" });
globalStyle(`${R} .gap-1`, { gap: "0.25rem" });
globalStyle(`${R} .gap-2`, { gap: "0.5rem" });
globalStyle(`${R} .gap-4`, { gap: "1rem" });
globalStyle(`${R} .space-y-1\\.5 > * + *`, { marginTop: "0.375rem" });
globalStyle(`${R} .w-full`, { width: "100%" });
globalStyle(`${R} .h-6`, { height: "1.5rem" });
globalStyle(`${R} .h-2\\.5`, { height: "0.625rem" });
globalStyle(`${R} .w-2\\.5`, { width: "0.625rem" });
globalStyle(`${R} .min-w-\\[140px\\]`, { minWidth: "140px" });
globalStyle(`${R} .px-3`, { paddingLeft: "0.75rem", paddingRight: "0.75rem" });
globalStyle(`${R} .px-4`, { paddingLeft: "1rem", paddingRight: "1rem" });
globalStyle(`${R} .py-1`, { paddingTop: "0.25rem", paddingBottom: "0.25rem" });
globalStyle(`${R} .py-2\\.5`, {
    paddingTop: "0.625rem",
    paddingBottom: "0.625rem",
});
globalStyle(`${R} .mb-2`, { marginBottom: "0.5rem" });
globalStyle(`${R} .text-xs`, { fontSize: "0.75rem", lineHeight: "1rem" });
globalStyle(`${R} .text-sm`, { fontSize: "0.875rem", lineHeight: "1.25rem" });
globalStyle(`${R} .whitespace-nowrap`, { whiteSpace: "nowrap" });
globalStyle(`${R} .font-medium`, { fontWeight: 500 });
globalStyle(`${R} .tabular-nums`, { fontVariantNumeric: "tabular-nums" });
globalStyle(`${R} .rounded-full`, { borderRadius: "9999px" });
globalStyle(`${R} .rounded-lg`, { borderRadius: "0.5rem" });
globalStyle(`${R} .overflow-hidden`, { overflow: "hidden" });
globalStyle(`${R} .shadow-lg`, {
    boxShadow:
        "0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)",
});
globalStyle(`${R} .backdrop-blur-md`, { backdropFilter: "blur(12px)" });
globalStyle(`${R} .pointer-events-none`, { pointerEvents: "none" });
globalStyle(`${R} .text-white`, { color: "#ffffff" });
globalStyle(`${R} .text-chart-label`, { color: "var(--chart-label)" });
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
