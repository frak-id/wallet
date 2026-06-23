import { vars } from "@frak-labs/design-system/theme";
import { brand } from "@frak-labs/design-system/tokens";
import { globalStyle } from "@vanilla-extract/css";
import { loginStackedMedia } from "@/module/login/component/Login/breakpoints";

// The login locks to a fixed full-screen split on wide viewports (no scroll →
// no scrollbar) and collapses to a scrollable single column when stacked.
// Derived from the login layout's breakpoint so the two never drift.

globalStyle('html[data-page="authentication"]', {
    position: "relative",
    overflow: "hidden",
    height: "100%",
    background: vars.surface.background2,
    color: brand.colors.neutral.grey800,
    // Fixed full-screen login: no visible scrollbar. Stacked content still
    // scrolls (wheel/touch); we only hide the bar.
    scrollbarWidth: "none",
    "@media": {
        [loginStackedMedia]: {
            overflow: "auto",
            height: "auto",
        },
    },
});

// WebKit/Blink scrollbar hiding (scrollbar-width is Firefox-only).
globalStyle(
    'html[data-page="authentication"]::-webkit-scrollbar, html[data-page="authentication"] body::-webkit-scrollbar',
    {
        display: "none",
    }
);

globalStyle('html[data-page="authentication"] body', {
    position: "relative",
    overflow: "hidden",
    height: "100%",
    "@media": {
        [loginStackedMedia]: {
            overflow: "auto",
            height: "auto",
        },
    },
});

globalStyle('html[data-page="authentication"] a', {
    color: brand.colors.neutral.grey800,
});
