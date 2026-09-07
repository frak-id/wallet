/**
 * `es-check` ships no type declarations and has no `@types` package.
 * Only the surface {@link assertBundleEsVersion} uses is declared here.
 */
declare module "es-check" {
    type EsCheckConfig = {
        files: string[];
        ecmaVersion?: string;
        /** Parse as ESM. Required, or every emitted chunk fails on its own `import`. */
        module?: boolean;
        /** AST-level stdlib detection. Required to catch above-floor method calls. */
        checkFeatures?: boolean;
        /** Comma-separated feature names, not an array — an array throws. */
        ignore?: string;
    };

    type EsCheckError = {
        file?: string;
        /** Present for feature violations; `features` names the offending APIs. */
        err?: { message?: string; features?: string[] };
    };

    /**
     * `isNodeAPI: true` is mandatory: without it es-check calls `process.exit`
     * and takes the host build down with it.
     */
    export function runChecks(
        configs: EsCheckConfig[],
        options: { isNodeAPI: boolean }
    ): { success: boolean; errors: EsCheckError[] };
}
