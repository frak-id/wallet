/**
 * Whether the app is running on a production stage.
 *
 * `STAGE` is inlined at build time by Vite `define` (see vite.config.ts) and
 * mirrors infra's stage naming (infra/utils.ts): production stages contain
 * "production", or the bare "prod". Kept as a function so it reflects
 * `process.env.STAGE` at call time — a build-time constant in the shipped
 * bundle, but the live env under test.
 */
export function isProd(): boolean {
    const stage = process.env.STAGE ?? "";
    return stage === "prod" || stage.includes("production");
}
