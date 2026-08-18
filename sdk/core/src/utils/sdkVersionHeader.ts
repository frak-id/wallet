/**
 * `x-frak-sdk-version` header, spreadable so an unknown version yields no key
 * at all. Stays a function: `process.env.SDK_VERSION` is substituted at build
 * time only, and a monorepo consumer importing source defines no `process`.
 */
export function sdkVersionHeaders(): Record<string, string> {
    const version = process.env.SDK_VERSION;
    return version ? { "x-frak-sdk-version": version } : {};
}
