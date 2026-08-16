/**
 * `x-frak-sdk-version` header, spreadable so an unknown version yields no
 * key at all. `process.env.SDK_VERSION` is substituted at build time only,
 * so a monorepo consumer importing source sees the literal expression.
 */
export function sdkVersionHeaders(): Record<string, string> {
    const version = process.env.SDK_VERSION;
    if (
        typeof version !== "string" ||
        version === "" ||
        version.startsWith("process.env")
    ) {
        return {};
    }
    return { "x-frak-sdk-version": version };
}
