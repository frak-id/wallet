declare module "*.css";

/**
 * React 19 moved JSX types from global `JSX` to `React.JSX`.
 * Bridge App Bridge types that only declare in the old namespace.
 */
declare namespace React.JSX {
    interface IntrinsicElements {
        "ui-nav-menu": import("@shopify/app-bridge-types").UINavMenuAttributes;
    }
}
