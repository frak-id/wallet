// Public project token and managed proxy of Frak's PostHog project; both ship in bundles.
const POSTHOG_HOST = "https://e.frak.id";
const POSTHOG_TOKEN = "phc_ynE8Ez8kzXRo4woBEEqG8Nxs5ZLsj7dvWQ5RDcQwG2Cw";

/** Build-time `define` entries for the PostHog mirror; both are `undefined` unless `production`. */
export function postHogDefines(production: boolean): Record<string, string> {
    return {
        "process.env.POSTHOG_HOST": production
            ? JSON.stringify(POSTHOG_HOST)
            : "undefined",
        "process.env.POSTHOG_TOKEN": production
            ? JSON.stringify(POSTHOG_TOKEN)
            : "undefined",
    };
}
