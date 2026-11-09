// Demo only: once a scenario is picked (section 9 of index.html), the SDK's
// reward-summary request is answered with that sample visitor, so every
// reminder surface renders without a real unclaimed reward. Must load before
// the SDK script.
(() => {
    const STORAGE_KEY = "frak-demo-reward-scenario";
    const DAY = 86_400_000;
    const eur = (value) => ({
        eurAmount: value,
        usdAmount: Math.round(value * 108) / 100,
        gbpAmount: Math.round(value * 85) / 100,
    });
    const inDays = (days) => new Date(Date.now() + days * DAY).toISOString();
    const laterToday = () => {
        const end = new Date();
        end.setHours(23, 30, 0, 0);
        return new Date(
            Math.max(end.getTime(), Date.now() + 600_000)
        ).toISOString();
    };

    const scenarios = {
        waiting: () => ({
            linked: false,
            pending: {
                total: eur(14.5),
                cashback: eur(10),
                fromFriends: eur(4.5),
                count: 2,
                lockedCount: 0,
                nextUnlockAt: null,
                expiresAt: inDays(30),
            },
            earned: null,
        }),
        partlyLocked: () => ({
            linked: false,
            pending: {
                total: eur(24.5),
                cashback: eur(10),
                fromFriends: eur(14.5),
                count: 3,
                lockedCount: 1,
                nextUnlockAt: inDays(5),
                expiresAt: inDays(30),
            },
            earned: null,
        }),
        lastDay: () => ({
            linked: false,
            pending: {
                total: eur(14.5),
                cashback: eur(10),
                fromFriends: eur(4.5),
                count: 2,
                lockedCount: 0,
                nextUnlockAt: null,
                expiresAt: laterToday(),
            },
            earned: null,
        }),
        linked: () => ({
            linked: true,
            pending: {
                total: eur(4.5),
                cashback: eur(0),
                fromFriends: eur(4.5),
                count: 1,
                lockedCount: 1,
                nextUnlockAt: inDays(5),
                expiresAt: inDays(85),
            },
            earned: { total: eur(32) },
        }),
    };

    const current = sessionStorage.getItem(STORAGE_KEY);
    const build = scenarios[current];
    if (build) {
        const summary = build();
        const realFetch = window.fetch.bind(window);
        window.fetch = (input, init) => {
            const url =
                typeof input === "string" || input instanceof URL
                    ? String(input)
                    : input.url;
            if (url.includes("/user/merchant/rewards-summary")) {
                return Promise.resolve(
                    new Response(JSON.stringify(summary), {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    })
                );
            }
            return realFetch(input, init);
        };
        console.info(`[reward demo] simulating "${current}"`, summary);
    }

    // The SDK caches the summary and the dismissal: drop both so a switch shows at once.
    const forgetCachedSummary = () => {
        for (const store of [localStorage, sessionStorage]) {
            for (const key of Object.keys(store)) {
                if (
                    key.startsWith("frak-reward-summary-") ||
                    key.startsWith("frak-reward-reminder-dismissed-")
                ) {
                    store.removeItem(key);
                }
            }
        }
    };

    document.addEventListener("click", (event) => {
        const button = event.target.closest?.("[data-reward-demo]");
        if (!button) return;
        const scenario = button.getAttribute("data-reward-demo");
        if (scenarios[scenario]) sessionStorage.setItem(STORAGE_KEY, scenario);
        else sessionStorage.removeItem(STORAGE_KEY);
        forgetCachedSummary();
        window.location.reload();
    });

    document.addEventListener("DOMContentLoaded", () => {
        const status = document.getElementById("reward-demo-status");
        if (status) {
            status.textContent = build
                ? `Simulating: ${current}. Reload keeps it for this tab.`
                : "Off: the components read this visitor's real rewards.";
        }
        for (const button of document.querySelectorAll("[data-reward-demo]")) {
            const active =
                button.getAttribute("data-reward-demo") ===
                (build ? current : "off");
            button.setAttribute("aria-pressed", String(active));
        }
    });
})();
