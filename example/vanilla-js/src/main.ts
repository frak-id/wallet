import type { FrakClient } from "@frak-labs/core-sdk";
import { getClientId, sdkConfigStore } from "@frak-labs/core-sdk";
import { displayModal } from "@frak-labs/core-sdk/actions";

function log(
    message: string,
    type: "info" | "warn" | "error" | "success" = "info",
    statusBoxId = "merge-status"
) {
    const statusBox = document.getElementById(statusBoxId);
    if (!statusBox) return;

    const timestamp = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.className = type;
    div.textContent = `[${timestamp}] ${message}`;
    statusBox.appendChild(div);
    statusBox.scrollTop = statusBox.scrollHeight;
}

function updateClientIdDisplay() {
    const display = document.getElementById("current-client-id");
    if (display) {
        display.textContent = getClientId();
    }
}

function checkForMergeToken() {
    const url = new URL(window.location.href);
    const mergeToken = url.searchParams.get("fmt");

    if (mergeToken) {
        log("Merge token detected in URL!", "success");
        log(`Token: ${mergeToken.substring(0, 50)}...`, "info");
        log(
            "Listener will auto-process this token and link identities",
            "info"
        );
    }
}

function handleClearId() {
    if (window.localStorage) {
        localStorage.removeItem("frak-client-id");
    }
    log("Client ID cleared - refreshing to get new ID...", "info");
    setTimeout(() => window.location.reload(), 500);
}

function waitForClient(): Promise<FrakClient> {
    if (window.FrakSetup?.client) {
        return Promise.resolve(window.FrakSetup.client);
    }
    return new Promise((resolve) => {
        window.addEventListener(
            "frak:client",
            () => {
                if (window.FrakSetup?.client) {
                    resolve(window.FrakSetup.client);
                }
            },
            { once: true }
        );
    });
}

async function handleModalWithPlacement(
    placement: string | undefined,
    statusBoxId: string
) {
    const label = placement ?? "none";
    log(`Triggering modal with placement="${label}"...`, "info", statusBoxId);

    const client = await waitForClient();

    try {
        const result = await displayModal(
            client,
            {
                steps: {
                    login: { allowSso: true },
                    final: {
                        action: { key: "reward" },
                    },
                },
                metadata: {
                    header: {
                        title: `Test — placement: ${label}`,
                    },
                },
            },
            placement
        );
        log(
            `Modal completed: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Modal error: ${e}`, "error", statusBoxId);
    }
}

async function handleModalBackendTranslations() {
    const statusBoxId = "backend-i18n-status";
    log(
        "Opening modal — translations come from backend sdkConfig",
        "info",
        statusBoxId
    );

    const config = sdkConfigStore.getConfig();
    log(
        `Config resolved: ${config.isResolved}, global translations: ${config.translations ? Object.keys(config.translations).length : 0} keys`,
        "info",
        statusBoxId
    );

    const client = await waitForClient();

    try {
        const result = await displayModal(client, {
            steps: {
                login: { allowSso: true },
                final: {
                    action: { key: "reward" },
                },
            },
            metadata: {
                header: {
                    title: "Backend Translations Test",
                },
            },
        });
        log(
            `Modal completed: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Modal error: ${e}`, "error", statusBoxId);
    }
}

async function handleModalDevI18n() {
    const statusBoxId = "dev-vs-backend-status";
    log(
        "Opening modal — uses SDK customizations.i18n (dev), overwritten by backend for overlapping keys",
        "info",
        statusBoxId
    );

    const client = await waitForClient();

    try {
        const result = await displayModal(client, {
            steps: {
                login: { allowSso: true },
                final: {
                    action: { key: "reward" },
                },
            },
            metadata: {
                header: {
                    title: "Dev i18n (from SDK config)",
                },
            },
        });
        log(
            `Modal completed: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Modal error: ${e}`, "error", statusBoxId);
    }
}

async function handleModalPerModalI18n() {
    const statusBoxId = "dev-vs-backend-status";
    log(
        "Opening modal — per-modal metadata.i18n overrides SDK and backend translations",
        "info",
        statusBoxId
    );

    const client = await waitForClient();

    try {
        const result = await displayModal(client, {
            steps: {
                login: { allowSso: true },
                final: {
                    action: { key: "reward" },
                },
            },
            metadata: {
                header: {
                    title: "Per-modal i18n Override",
                },
                i18n: {
                    fr: {
                        "sharing.modal.title":
                            "Partager (PER-MODAL override FR)",
                        "sharing.modal.description":
                            "Cette traduction vient du paramètre metadata.i18n de displayModal()",
                    },
                    en: {
                        "sharing.modal.title": "Share (PER-MODAL override EN)",
                        "sharing.modal.description":
                            "This translation comes from displayModal() metadata.i18n parameter",
                    },
                },
            },
        });
        log(
            `Modal completed: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Modal error: ${e}`, "error", statusBoxId);
    }
}

async function handleModalPlacementI18n() {
    const statusBoxId = "dev-vs-backend-status";
    log(
        'Opening modal with placement="hero-share" — placement translations override everything',
        "info",
        statusBoxId
    );

    const placement = "hero-share";
    const resolved = sdkConfigStore.getConfig().placements?.[placement];
    log(
        `Placement "${placement}" resolved: ${resolved ? `components=${JSON.stringify(resolved.components)}, translations=${resolved.translations ? Object.keys(resolved.translations).length : 0} keys` : "NOT FOUND"}`,
        resolved ? "info" : "warn",
        statusBoxId
    );

    const client = await waitForClient();

    try {
        const result = await displayModal(
            client,
            {
                steps: {
                    login: { allowSso: true },
                    final: {
                        action: { key: "reward" },
                    },
                },
                metadata: {
                    header: {
                        title: "Placement i18n (hero-share)",
                    },
                },
            },
            placement
        );
        log(
            `Modal completed: ${JSON.stringify(result)}`,
            "success",
            statusBoxId
        );
    } catch (e) {
        log(`Modal error: ${e}`, "error", statusBoxId);
    }
}

function bindTestButtons() {
    document
        .getElementById("btn-modal-no-placement")
        ?.addEventListener("click", () =>
            handleModalWithPlacement(undefined, "modal-placement-status")
        );
    document
        .getElementById("btn-modal-hero")
        ?.addEventListener("click", () =>
            handleModalWithPlacement("hero-share", "modal-placement-status")
        );
    document
        .getElementById("btn-modal-sidebar")
        ?.addEventListener("click", () =>
            handleModalWithPlacement("sidebar-promo", "modal-placement-status")
        );
    document
        .getElementById("btn-modal-backend-translations")
        ?.addEventListener("click", handleModalBackendTranslations);
    document
        .getElementById("btn-modal-dev-i18n")
        ?.addEventListener("click", handleModalDevI18n);
    document
        .getElementById("btn-modal-permodal-i18n")
        ?.addEventListener("click", handleModalPerModalI18n);
    document
        .getElementById("btn-modal-placement-i18n")
        ?.addEventListener("click", handleModalPlacementI18n);
}

async function init() {
    if (!process.env.USE_CDN) {
        await Promise.all([
            import("@frak-labs/components/dist/buttonWallet.js"),
            import("@frak-labs/components/dist/buttonWallet.css"),
            import("@frak-labs/components/dist/buttonShare.js"),
            import("@frak-labs/components/dist/buttonShare.css"),
            import("@frak-labs/components/dist/openInApp.js"),
            import("@frak-labs/components/dist/openInApp.css"),
        ]);
    }

    updateClientIdDisplay();
    checkForMergeToken();
    bindTestButtons();

    document
        .getElementById("btn-clear-id")
        ?.addEventListener("click", handleClearId);
}

init();
