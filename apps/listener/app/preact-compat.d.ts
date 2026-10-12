import type { useErrorBoundary as preactUseErrorBoundary } from "preact/hooks";

// Import it from "react" (aliased to preact/compat): a direct "preact/hooks" import is a second hooks instance under vitest.
declare module "react" {
    export const useErrorBoundary: typeof preactUseErrorBoundary;
}
