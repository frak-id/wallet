// Every screen the harness can render: [name, route path, scenario params]. Params are read by harness/main.tsx.
export const SCENARIOS = [
    ["home-onboarding-step1", "/app", { onboarding: "1" }],
    ["home-onboarding-step2", "/app", { onboarding: "2" }],
    ["home-onboarding-step3", "/app", { onboarding: "3" }],
    ["home-onboarding-step4", "/app", { onboarding: "4" }],
    ["home-onboarding-step5", "/app", { onboarding: "5" }],
    ["home-onboarding-step6", "/app", { onboarding: "6" }],
    ["home-onboarding-step7", "/app", { onboarding: "7" }],
    ["home-dashboard", "/app", {}],
    ["home-dashboard-legacy-theme", "/app", { theme: "legacy" }],
    ["campaigns", "/app/campaigns", {}],
    [
        "campaigns-budget-depleted",
        "/app/campaigns",
        { distribution: "depleted" },
    ],
    ["funding", "/app/funding", {}],
    ["funding-rewards-paused", "/app/funding", { bank: "paused" }],
    ["funding-limit-too-low", "/app/funding", { bank: "lowlimit" }],
    [
        "funding-empty-no-purchase",
        "/app/funding",
        { bank: "empty", purchases: "none" },
    ],
    [
        "funding-bank-not-deployed",
        "/app/funding",
        { bank: "undeployed", purchases: "none" },
    ],
    ["appearance", "/app/appearance", {}],
    ["appearance-installed", "/app/appearance", { button: "1", banner: "1" }],
    ["appearance-legacy-theme", "/app/appearance", { theme: "legacy" }],
    ["ambassador-live", "/app/ambassador", { status: "live" }],
    ["ambassador-draft", "/app/ambassador", { status: "draft" }],
    ["settings", "/app/settings", {}],
    ["settings-incomplete", "/app/settings", { onboarding: "2" }],
    ["app-error", "/app/error", {}],
    ["purchase-confirmed", "/purchase", { state: "confirmed" }],
    ["purchase-pending", "/purchase", { state: "pending" }],
    ["purchase-processing", "/purchase", { state: "processing" }],
    ["purchase-declined", "/purchase", { state: "declined" }],
    ["purchase-not-found", "/purchase", { state: "missing" }],
    ["login", "/auth/login", {}],
    ["login-invalid-shop", "/auth/login", { error: "invalid" }],
];

/** Text harness/main.tsx's error boundary prints; any other scenario showing it failed to render. */
export const ERROR_BOUNDARY_ID = "harness-error-boundary";

/** SCENARIOS filtered by the comma-separated name substrings in VERIFY_ONLY, when set. */
export function selectedScenarios() {
    const only = process.env.VERIFY_ONLY?.split(",").filter(Boolean);
    return only
        ? SCENARIOS.filter(([name]) => only.some((o) => name.includes(o)))
        : SCENARIOS;
}
